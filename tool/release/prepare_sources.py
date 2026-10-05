# SPDX-License-Identifier: GPL-2.0-or-later
"""Prepare a local, reviewable source candidate. Never uploads release files."""

import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from fnmatch import fnmatchcase
import gzip
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import urllib.request

from audit_source_notices import build_report

ROOT = Path(__file__).resolve().parents[2]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def integrity_ok(data, integrity):
    for token in integrity.split():
        algorithm, value = token.split('-', 1)
        if algorithm not in ('sha256', 'sha384', 'sha512', 'sha1'):
            continue
        if base64.b64encode(hashlib.new(algorithm, data).digest()).decode() == value:
            return True
    return False


def fetch(record, cache, offline):
    url = record['url']
    if not url.startswith(('https://registry.npmjs.org/', 'https://codeload.github.com/')):
        raise ValueError(f'Unexpected source host: {url}')
    key = digest(url.encode()) + '.tgz'
    cached = cache / key
    data = cached.read_bytes() if cached.exists() else None
    valid = lambda b: (digest(b) == record['sha256'] if 'sha256' in record
                       else integrity_ok(b, record['integrity']))
    if data is None or not valid(data):
        if offline:
            raise ValueError(f'Missing or invalid cached input: {url}')
        request = urllib.request.Request(url, headers={'User-Agent': 'ckeditor-source-preparation'})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        if not valid(data):
            raise ValueError(f'Source integrity mismatch: {url}')
        # Verify before caching; each unique URL is downloaded once.
        cached.write_bytes(data)
    return {**record, 'file': 'inputs/' + key, 'size': len(data), 'sha256': digest(data)}


def snapshot_files():
    names = subprocess.check_output(
        ['git', 'ls-files', '--cached', '--others', '--exclude-standard', '-z'],
        cwd=ROOT).decode().split('\0')
    root_files = {'LICENSE', 'README.md', 'CONTRIBUTING.md', 'THIRD_PARTY_NOTICES.md',
                  'CHANGELOG.md', 'pubspec.yaml', 'analysis_options.yaml', '.pubignore', '.gitignore'}
    folders = {'lib', 'bin', 'assets', 'tool', 'test', 'example'}
    selected = []
    for name in sorted(set(names)):
        if not name:
            continue
        p = Path(name)
        if name not in root_files and p.parts[0] not in folders:
            continue
        if any(part in {'node_modules', 'build', '__pycache__', 'AGENTS.md', 'agents.md'}
               or part.startswith('.') for part in p.parts) and name not in root_files:
            continue
        if any(part.startswith('.env') for part in p.parts):
            continue
        source = ROOT / p
        if source.is_symlink():
            raise ValueError(f'Review source symlink before archiving: {name}')
        if source.is_file():
            selected.append((name, source))
    return selected


def add_file(archive, name, data, mode=0o644):
    info = tarfile.TarInfo(name)
    info.size = len(data)
    info.mode = mode
    info.mtime = 0
    archive.addfile(info, io.BytesIO(data))


def select_upstream(record, cache):
    """Keep source/build inputs; record every retained file and original digest."""
    excluded = record.get('excludeDirectories', [])
    if not excluded:
        return record
    prefixes = [PurePosixPath(pattern).parts for pattern in excluded]
    original = (cache / Path(record['file']).name).read_bytes()
    selected = []
    removed = 0
    with tarfile.open(fileobj=io.BytesIO(original)) as archive:
        for member in archive:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or '\\' in member.name:
                raise ValueError(f'Unsafe upstream path: {member.name}')
            if member.isdir():
                continue
            if not member.isfile() or len(path.parts) < 2:
                raise ValueError(f'Unsupported upstream member: {member.name}')
            relative = PurePosixPath(*path.parts[1:])
            # Notice files survive even inside excluded documentation/test trees.
            notice = relative.name.lower().startswith(
                ('license', 'licence', 'copying', 'notice', 'copyright', 'acknowledg'))
            if not notice and any(len(relative.parts) > len(parts) and
                                  all(fnmatchcase(part, pattern) for part, pattern
                                      in zip(relative.parts, parts)) for parts in prefixes):
                removed += 1
                continue
            data = archive.extractfile(member).read()
            selected.append((member.name, data, member.mode & 0o777))
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            for name, data, mode in sorted(selected):
                add_file(archive, name, data, mode)
    data = buffer.getvalue()
    checksum = digest(data)
    filename = checksum + '.selected.tgz'
    (cache / filename).write_bytes(data)
    return {**record, 'file': 'inputs/' + filename, 'sha256': checksum, 'size': len(data),
            'originalSha256': record['sha256'], 'originalSize': record['size'],
            'selection': {
                'excludedFileCount': removed, 'preserveNoticeFiles': True,
                'files': [{'path': name, 'sha256': digest(content), 'size': len(content)}
                          for name, content, mode in sorted(selected)],
            }}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache', type=Path, default=ROOT / '.dart_tool/release/cache')
    parser.add_argument('--output', type=Path, default=ROOT / '.dart_tool/release/source-candidate.tar.gz')
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    cache = args.cache.resolve()
    output = args.output.resolve()
    if output.exists():
        parser.error('Output already exists; choose another path to preserve the reviewed candidate.')
    cache.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    source_inputs = json.loads((ROOT / 'tool/release/source-inputs.json').read_text())
    records = {}
    installations = []
    for recipe in ['tool/ckeditor_build', 'tool/release/source-build']:
        lock = json.loads((ROOT / recipe / 'package-lock.json').read_text())
        packages = []
        omitted = []
        for location, item in lock['packages'].items():
            if not location:
                continue
            if item.get('link') or not item.get('resolved') or not item.get('integrity'):
                raise ValueError(f'Unpinned dependency: {recipe}/{location}')
            if item.get('optional'):
                omitted.append({'location': location, 'version': item['version'],
                                'url': item['resolved'], 'integrity': item['integrity']})
                continue
            record = {'url': item['resolved'], 'integrity': item['integrity'], 'kind': 'npm'}
            prior = records.setdefault(record['url'], record)
            if prior['integrity'] != record['integrity']:
                raise ValueError('Conflicting integrity records')
            packages.append({'location': location, 'version': item['version'], 'url': record['url']})
        installations.append({'recipe': recipe, 'packages': packages,
                              'omitOptional': True, 'omittedPackages': omitted})
    for item in source_inputs['upstreamArchives']:
        records[item['url']] = {**item, 'kind': 'upstream'}
    for item in source_inputs.get('extraNpmInputs', []):
        records[item['url']] = {**item, 'kind': 'reference-npm'}
    print(f'Verifying {len(records)} pinned source inputs...', flush=True)
    with ThreadPoolExecutor(max_workers=6) as workers:
        verified = list(workers.map(lambda r: fetch(r, cache, args.offline), records.values()))
    verified = [select_upstream(record, cache) if record['kind'] == 'upstream' else record
                for record in verified]
    files = snapshot_files()
    manifest = {
        'schemaVersion': 1, 'status': source_inputs['status'],
        'packageCommit': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=ROOT, text=True).strip(),
        'includesWorkingTreeChanges': bool(subprocess.check_output(['git', 'status', '--porcelain'], cwd=ROOT)),
        'unresolved': source_inputs['unresolved'], 'inputs': sorted(verified, key=lambda r: r['file']),
        'installations': installations,
        'packageFiles': [{'path': name, 'sha256': digest(p.read_bytes())} for name, p in files],
    }
    notice_report = build_report(manifest,
                                 lambda name: (cache / Path(name).name).read_bytes(),
                                 lambda name: (ROOT / name).read_bytes())
    if notice_report['summary']['byStatus'].get('unreviewed-missing-notice'):
        raise ValueError('New missing notices require review before source preparation')
    # Fixed timestamps and ordering make unchanged candidates reproducible.
    partial = output.with_name(output.name + '.partial')
    if partial.exists():
        parser.error('A partial output exists; review it or choose another output path.')
    with partial.open('wb') as handle, gzip.GzipFile(fileobj=handle, mode='wb', filename='', mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode='w') as archive:
            add_file(archive, 'SOURCE_MANIFEST.json', (json.dumps(manifest, indent=2) + '\n').encode())
            add_file(archive, 'SOURCE_NOTICE_REPORT.json',
                     (json.dumps(notice_report, indent=2) + '\n').encode())
            for name, path in files:
                add_file(archive, 'package/' + name, path.read_bytes())
            for record in manifest['inputs']:
                add_file(archive, record['file'], (cache / Path(record['file']).name).read_bytes())
    partial.replace(output)
    checksum = digest(output.read_bytes())
    output.with_suffix(output.suffix + '.sha256').write_text(checksum + '  ' + output.name + '\n')
    print(json.dumps({'archive': str(output), 'sha256': checksum, 'bytes': output.stat().st_size,
                      'packageFiles': len(files), 'sourceInputs': len(verified), 'status': manifest['status']}))


if __name__ == '__main__':
    main()
