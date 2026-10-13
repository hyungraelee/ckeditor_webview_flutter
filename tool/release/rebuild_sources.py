# SPDX-License-Identifier: GPL-2.0-or-later
"""Extract and rebuild a reviewed source candidate without network access."""

import argparse
import hashlib
import json
from pathlib import Path, PurePosixPath
import subprocess
import tarfile
import tempfile

from audit_source_notices import build_report


def safe_extract(source, destination, strip_root=False):
    with tarfile.open(source) as archive:
        for member in archive.getmembers():
            parts = Path(member.name).parts
            if Path(member.name).is_absolute() or '..' in parts:
                raise ValueError(f'Unsafe archive member: {member.name}')
            if strip_root:
                parts = parts[1:]
            if member.isdir():
                continue
            if not member.isfile() or not parts:
                raise ValueError(f'Unsupported archive member: {member.name}')
            target = destination.joinpath(*parts)
            if target.exists():
                raise ValueError(f'Duplicate archive member: {member.name}')
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.extractfile(member).read())


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def inside(root, name):
    relative = PurePosixPath(name)
    if relative.is_absolute() or '..' in relative.parts or not relative.parts or '\\' in name:
        raise ValueError(f'Unsafe manifest path: {name}')
    return root.joinpath(*relative.parts)


def run(command, cwd):
    subprocess.run(command, cwd=cwd, check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    parser.add_argument('--work', type=Path)
    args = parser.parse_args()
    archive = args.archive.resolve()
    checksum = archive.with_suffix(archive.suffix + '.sha256')
    if not checksum.exists() or sha256(archive) != checksum.read_text().split()[0]:
        parser.error('Missing checksum sidecar or archive checksum mismatch.')
    if args.work:
        work = args.work.resolve()
        work.mkdir(parents=True, exist_ok=False)
    else:
        work = Path(tempfile.mkdtemp(prefix='ckeditor-source-rebuild-'))
    print(f'Rebuild workspace: {work}', flush=True)
    safe_extract(archive, work)
    manifest = json.loads((work / 'SOURCE_MANIFEST.json').read_text())
    if manifest['schemaVersion'] != 1:
        raise ValueError('Unsupported source manifest version')
    for item in manifest['packageFiles']:
        if sha256(inside(work / 'package', item['path'])) != item['sha256']:
            raise ValueError(f'Package source checksum mismatch: {item["path"]}')
    inputs = {}
    for item in manifest['inputs']:
        source = inside(work, item['file'])
        if sha256(source) != item['sha256']:
            raise ValueError('Dependency/source archive checksum mismatch')
        inputs[item['url']] = source
        if item['kind'] == 'upstream':
            if 'selection' in item:
                with tarfile.open(source) as selected:
                    members = {m.name: m for m in selected if m.isfile()}
                    expected_files = item['selection']['files']
                    if len(members) != len(expected_files):
                        raise ValueError('Selected upstream file count differs')
                    for entry in expected_files:
                        member = members.get(entry['path'])
                        if member is None or member.size != entry['size'] or hashlib.sha256(
                                selected.extractfile(member).read()).hexdigest() != entry['sha256']:
                            raise ValueError('Selected upstream file checksum differs')
            safe_extract(source, inside(work / 'upstream', item['id']), strip_root=True)
    if (work / 'package/tool/release/notice-review.json').exists():
        report = build_report(manifest, lambda name: inside(work, name).read_bytes(),
                              lambda name: inside(work / 'package', name).read_bytes())
        if report != json.loads((work / 'SOURCE_NOTICE_REPORT.json').read_text()):
            raise ValueError('Notice report differs from the preserved evidence')
        if report['summary']['byStatus'].get('unreviewed-missing-notice'):
            raise ValueError('New missing notices require review')
    for install in manifest['installations']:
        recipe = inside(work / 'package', install['recipe'])
        lockfile = recipe / 'package-lock.json'
        lock = json.loads(lockfile.read_text())
        for item in lock['packages'].values():
            if 'resolved' in item:
                if item['resolved'] in inputs:
                    item['resolved'] = inputs[item['resolved']].as_uri()
                elif not (install.get('omitOptional') and item.get('optional')):
                    raise ValueError('Required npm input is absent from the candidate')
        # Rewrite download locations only in this disposable extraction.
        lockfile.write_text(json.dumps(lock, indent=2) + '\n')
        command = ['npm', 'ci', '--offline', '--ignore-scripts', '--no-audit', '--no-fund',
                   '--cache', str(work / 'npm-cache')]
        if install.get('omitOptional'):
            command.append('--omit=optional')
        run(command, recipe)
    package = work / 'package'
    asset_dir = package / 'assets/editor'
    expected = {p.name: sha256(p) for p in asset_dir.iterdir() if p.is_file()}
    if (package / 'tool/release/verify_color_sources.cjs').exists():
        run(['node', 'tool/release/verify_color_sources.cjs', str(work)], package)
    if (package / 'tool/release/verify_build_tool_sources.cjs').exists():
        run(['node', 'tool/release/verify_build_tool_sources.cjs', str(work)], package)
    run(['node', 'tool/release/rebuild-source-inputs.cjs', str(work)], package)
    run(['npm', 'run', 'build'], package / 'tool/ckeditor_build')
    for name in ['ckeditor.js', 'ckeditor.css', 'ckeditor.js.LICENSE.txt', 'CKEDITOR-LICENSE.txt',
                 'LODASH-LICENSE.txt', 'THIRD_PARTY_LICENSES.txt', 'build-info.json']:
        if sha256(asset_dir / name) != expected[name]:
            raise ValueError(f'Rebuilt release asset differs: {name}')
    report = {'archiveSha256': sha256(archive), 'status': 'source rebuild verified; publication review pending',
              'node': subprocess.check_output(['node', '--version'], text=True).strip(),
              'npm': subprocess.check_output(['npm', '--version'], text=True).strip(),
              'matchedAssets': expected, 'remainingReview': manifest['unresolved']}
    (work / 'REBUILD_REPORT.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'report': str(work / 'REBUILD_REPORT.json'), 'result': report['status']}))


if __name__ == '__main__':
    main()
