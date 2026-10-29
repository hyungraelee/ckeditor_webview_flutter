# SPDX-License-Identifier: GPL-2.0-or-later
"""Verify generated sources and hosted package bytes without publishing."""

import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
PACKAGE = 'ckeditor_webview_flutter'


def digest(data):
    return hashlib.sha256(data).hexdigest()


def verify_sources(archive, commit):
    data = archive.read_bytes()
    checksum = archive.with_name(archive.name + '.sha256').read_text().strip()
    if checksum != f'{digest(data)}  {archive.name}':
        raise ValueError('Source checksum sidecar differs')
    with tarfile.open(fileobj=io.BytesIO(data)) as bundle:
        manifest = json.load(bundle.extractfile('SOURCE_MANIFEST.json'))
        if manifest['packageCommit'] != commit or manifest['includesWorkingTreeChanges']:
            raise ValueError('Sources must identify the clean release commit')
        for item in manifest['packageFiles']:
            content = bundle.extractfile('package/' + item['path']).read()
            if digest(content) != item['sha256']:
                raise ValueError('Source package file digest differs')
    return {'archiveSha256': digest(data), 'commit': commit}


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read()


def hosted_version(version):
    try:
        return json.loads(fetch(f'https://pub.dev/api/packages/{PACKAGE}/versions/{version}'))
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def package_files(root):
    names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=root).decode().split('\0')
    roots = {'LICENSE', 'README.md', 'CHANGELOG.md', 'CONTRIBUTING.md',
             'THIRD_PARTY_NOTICES.md', 'pubspec.yaml', 'analysis_options.yaml'}
    folders = {'lib', 'bin', 'assets', 'tool', 'test', 'example'}
    return [name for name in names if name and (name in roots or
            (Path(name).parts[0] in folders and
             not any(part.startswith('.') for part in Path(name).parts)))]


def verify_hosted(record, root):
    url = record['archive_url']
    expected_url = f'https://pub.dev/api/archives/{PACKAGE}-{record["version"]}.tar.gz'
    if url != expected_url:
        raise ValueError('Unexpected hosted archive URL')
    data = fetch(url)
    if digest(data) != record['archive_sha256']:
        raise ValueError('Hosted archive digest differs from pub.dev metadata')
    with tarfile.open(fileobj=io.BytesIO(data)) as bundle:
        members = {member.name: member for member in bundle.getmembers()}
        forbidden = {'.agents', '.codex', '.git', '.dart_tool', 'node_modules',
                     '__pycache__', 'AGENTS.md', 'agents.md'}
        for name in members:
            if any(part in forbidden or part.startswith('.env') for part in Path(name).parts):
                raise ValueError('Hosted archive contains excluded local files')
        expected = package_files(root)
        for name in expected:
            member = members.get(name)
            if member is None or not member.isfile():
                raise ValueError(f'Hosted package is missing {name}')
            if bundle.extractfile(member).read() != (root / name).read_bytes():
                raise ValueError(f'Hosted package differs from release checkout: {name}')
    return {'version': record['version'], 'archiveSha256': digest(data),
            'matchedReleaseFiles': len(expected)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['sources', 'published', 'hosted'])
    parser.add_argument('--metadata', type=Path, default=ROOT / '.dart_tool/release/metadata.json')
    args = parser.parse_args()
    meta = json.loads(args.metadata.read_text())
    directory = args.metadata.parent
    if args.command == 'sources':
        result = verify_sources(directory / meta['archive'], meta['commit'])
    elif args.command == 'published':
        result = {'published': hosted_version(meta['version']) is not None}
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f'published={str(result["published"]).lower()}\n')
    else:
        for attempt in range(12):
            record = hosted_version(meta['version'])
            if record is not None:
                break
            if attempt == 11:
                raise ValueError('Published version is not available on pub.dev')
            time.sleep(10)
        if record['version'] != meta['version']:
            raise ValueError('Hosted version differs from release metadata')
        result = verify_hosted(record, ROOT)
    (directory / f'{args.command}-verification.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result))


if __name__ == '__main__':
    main()
