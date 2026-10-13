# SPDX-License-Identifier: GPL-2.0-or-later
"""Inventory preserved notices without treating license declarations as approval."""

import argparse
import hashlib
import io
import json
from pathlib import Path, PurePosixPath
import tarfile


def digest(data):
    return hashlib.sha256(data).hexdigest()


def archive_files(data, strip_root=False):
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data)) as archive:
        for member in archive:
            path = PurePosixPath(member.name)
            if path.is_absolute() or '..' in path.parts or '\\' in member.name:
                raise ValueError(f'Unsafe notice input path: {member.name}')
            if member.isdir():
                continue
            if not member.isfile():
                raise ValueError(f'Unsupported notice input: {member.name}')
            name = str(PurePosixPath(*path.parts[1:])) if strip_root else member.name
            if name in files:
                raise ValueError(f'Duplicate notice input: {name}')
            files[name] = archive.extractfile(member).read()
    return files


def component_report(profile, packages, upstream, package_bytes):
    """Record distribution roles and source presence without approving licenses."""
    if profile['schemaVersion'] != 1:
        raise ValueError('Unsupported component review version')
    if len(packages) != profile['expectedNpmInputs']:
        raise ValueError('Changed npm input scope requires component review')
    inventory = json.loads(package_bytes('tool/release/bundled-source-inventory.json'))
    for name in ('ckeditor.js', 'ckeditor.css'):
        if digest(package_bytes('assets/editor/' + name)) != inventory['matchedAssetsSha256'][name]:
            raise ValueError('Emitted inventory bundle hash differs')
    if digest(package_bytes('tool/ckeditor_build/package-lock.json')) != inventory['lockfileSha256']:
        raise ValueError('Emitted inventory build lock differs')
    emitted = {row['npmTarball']: row for row in inventory['runtimePackages']}
    mappings = {}
    for group in profile['gplSourceMappings']:
        for entry in group['packages']:
            key = (entry['name'], group['version'])
            if key in mappings:
                raise ValueError('Duplicate GPL source mapping')
            mappings[key] = (group, entry)
    rows = []
    by_family = {}
    by_role = {}
    seen_emitted = set()
    seen_gpl = set()
    for package in packages:
        declaration = package['declaredLicense']
        family = declaration if isinstance(declaration, str) else next(
            (entry['family'] for entry in profile['legacyDeclarations']
             if declaration == entry['value']), None)
        if family not in profile['licenseFamilies']:
            raise ValueError(f'Unreviewed license declaration: {package["name"]}')
        role = 'emitted-editor' if package['url'] in emitted else 'retained-archive-input'
        if role == 'emitted-editor':
            entry = emitted[package['url']]
            if (package['name'], package['version'], package['integrity']) != (
                    entry['name'], entry['version'], entry['npmIntegrity']):
                raise ValueError('Emitted package evidence differs')
            seen_emitted.add(package['url'])
        row = {'name': package['name'], 'version': package['version'],
               'url': package['url'], 'licenseFamily': family, 'role': role}
        if family == 'GPL-2.0-or-later':
            key = (package['name'], package['version'])
            if key not in mappings:
                raise ValueError(f'Unreviewed GPL source mapping: {package["name"]}')
            group, entry = mappings[key]
            record, files = upstream[group['upstreamId']]
            metadata_path = entry['path'] + 'package.json'
            metadata = json.loads(files[metadata_path])
            if (metadata['name'], metadata['version']) != key:
                raise ValueError('GPL modification-source metadata differs')
            notice = files[group['noticePath']]
            # Root CKEditor aggregate uses src/; package modules may use theme/lib.
            prefixes = [entry['path'] + part + '/' for part in ('src', 'lib', 'theme', 'lang')]
            sources = sorted(name for name in files if name.startswith(tuple(prefixes))
                             and name.endswith(('.ts', '.js', '.css', '.scss', '.svg', '.po')))
            if not sources:
                raise ValueError(f'GPL modification-source files absent: {package["name"]}')
            evidence = [{'path': name, 'sha256': digest(files[name])} for name in sources]
            row['sourcePresence'] = {'upstreamId': group['upstreamId'], 'url': record['url'],
                'metadataPath': metadata_path, 'metadataSha256': digest(files[metadata_path]),
                'noticePath': group['noticePath'], 'noticeSha256': digest(notice),
                'sourceFileCount': len(sources),
                'sourceListSha256': digest(json.dumps(evidence, sort_keys=True).encode())}
            seen_gpl.add(key)
        by_family[family] = by_family.get(family, 0) + 1
        by_role[role] = by_role.get(role, 0) + 1
        rows.append(row)
    if seen_emitted != set(emitted) or len(seen_emitted) != profile['expectedEmittedInputs']:
        raise ValueError('Emitted package scope requires review')
    if seen_gpl != set(mappings):
        raise ValueError('Stale GPL source mapping')
    for notice in profile['supplementalNotices']:
        if digest(package_bytes(notice['packagePath'])) != notice['sha256']:
            raise ValueError('Supplemental source attribution differs')
    return {'status': profile['status'],
            'scope': 'roles, declarations and source presence; not complete applicability approval',
            'summary': {'byLicenseFamily': by_family, 'byRole': by_role,
                        'gplSourceMappings': len(seen_gpl)},
            'packages': rows, 'supplementalNotices': profile['supplementalNotices']}


def build_report(manifest, input_bytes, package_bytes):
    review = json.loads(package_bytes('tool/release/notice-review.json'))
    if review['schemaVersion'] != 1:
        raise ValueError('Unsupported notice review version')
    targeted = {entry['url']: entry for entry in review['reviewedInputs']}
    if len(targeted) != len(review['reviewedInputs']):
        raise ValueError('Duplicate targeted notice input')
    upstream = {}
    npm = []
    for record in manifest['inputs']:
        data = input_bytes(record['file'])
        if digest(data) != record['sha256']:
            raise ValueError(f'Notice input checksum mismatch: {record["file"]}')
        files = archive_files(data, strip_root=record['kind'] == 'upstream')
        if record['kind'] == 'upstream':
            upstream[record['id']] = (record, files)
        else:
            npm.append((record, files))
    packages = []
    seen = set()
    statuses = {}
    for record, files in npm:
        # Older npm tarballs can use the package name instead of "package/".
        candidates = sorted((name for name in files if PurePosixPath(name).name == 'package.json'),
                            key=lambda name: (len(PurePosixPath(name).parts), name))
        if not candidates or (len(candidates) > 1 and len(PurePosixPath(candidates[0]).parts) ==
                              len(PurePosixPath(candidates[1]).parts)):
            raise ValueError(f'Ambiguous npm package metadata: {record["url"]}')
        metadata = json.loads(files[candidates[0]])
        prefixes = ('license', 'licence', 'copying', 'notice', 'copyright', 'acknowledg')
        prefixes += tuple(review.get('additionalNoticePrefixes', []))
        notice_paths = sorted(name for name in files if PurePosixPath(name).name.lower().startswith(prefixes))
        entry = {'name': metadata['name'], 'version': metadata['version'],
                 'url': record['url'], 'integrity': record['integrity'],
                 'declaredLicense': metadata.get('license', metadata.get('licenses')),
                 'preservedNoticeFiles': [{'path': name, 'sha256': digest(files[name])}
                                          for name in notice_paths]}
        if record['url'] in targeted:
            evidence = targeted[record['url']]
            seen.add(record['url'])
            for field in ('name', 'version', 'integrity'):
                if entry[field] != evidence[field]:
                    raise ValueError(f'Targeted notice metadata differs: {entry["name"]}')
            status = evidence['status']
            if status == 'embedded-notice':
                content = files[evidence['path']]
            elif status == 'upstream-notice':
                source, source_files = upstream[evidence['upstreamId']]
                content = source_files[evidence['path']]
                entry['upstreamNoticeSource'] = source['url']
            elif status == 'declaration-only':
                if not entry['declaredLicense']:
                    raise ValueError('Expected license declaration is absent')
                content = None
            else:
                raise ValueError(f'Unknown notice evidence status: {status}')
            if content is not None and digest(content) != evidence['sha256']:
                raise ValueError(f'Reviewed notice content differs: {entry["name"]}')
            entry['reviewEvidence'] = evidence
        else:
            status = 'notice-file-present' if notice_paths else 'unreviewed-missing-notice'
        entry['status'] = status
        statuses[status] = statuses.get(status, 0) + 1
        packages.append(entry)
    if seen != set(targeted):
        raise ValueError('Targeted notice review contains stale inputs')
    copied = []
    for entry in review['copiedCodeNotices']:
        source, files = upstream[entry['upstreamId']]
        content = files[entry['path']]
        if digest(content) != entry['sha256'] or package_bytes(entry['packagePath']) != content:
            raise ValueError(f'Copied-code notice differs from pinned source: {entry["name"]}')
        copied.append({**entry, 'url': source['url']})
    comparisons = []
    copied_sources = []
    for entry in review.get('copiedCodeSourceFiles', []):
        source, files = upstream[entry['upstreamId']]
        if digest(files[entry['path']]) != entry['sha256']:
            raise ValueError(f'Reviewed copied-code source differs: {entry["id"]}')
        copied_sources.append({**entry, 'url': source['url']})
    npm_files = {record['url']: files for record, files in npm}
    for entry in review.get('sourceComparisons', []):
        if entry['kind'] == 'npm-source-map':
            mapping = json.loads(npm_files[entry['npmUrl']][entry['sourceMapPath']])
            content = dict(zip(mapping['sources'], mapping['sourcesContent']))
            matched = []
            for pair in entry['files']:
                data = upstream[entry['upstreamId']][1][pair['upstreamPath']]
                if content[pair['sourceMapName']].encode() != data:
                    raise ValueError('Upstream source differs from published source-map content')
                matched.append({**pair, 'sha256': digest(data)})
            comparisons.append({**entry, 'matchedFiles': matched})
        elif entry['kind'] == 'upstream-equality':
            data = upstream[entry['leftId']][1][entry['leftPath']]
            if data != upstream[entry['rightId']][1][entry['rightPath']]:
                raise ValueError('Development source differs from publication source')
            comparisons.append({**entry, 'sha256': digest(data)})
        elif entry['kind'] == 'npm-upstream-equality':
            data = upstream[entry['upstreamId']][1][entry['upstreamPath']]
            if data != npm_files[entry['npmUrl']][entry['npmPath']]:
                raise ValueError('Upstream source differs from locked npm source')
            comparisons.append({**entry, 'sha256': digest(data)})
        else:
            raise ValueError('Unknown source comparison kind')
    report = {'schemaVersion': 1, 'status': 'notice inventory; final publication review pending',
            'summary': {'npmInputs': len(packages), 'byStatus': statuses},
            'packages': sorted(packages, key=lambda entry: (entry['name'], entry['version'])),
            'copiedCodeNotices': copied, 'sourceComparisons': comparisons,
            'remainingReview': manifest['unresolved']}
    if 'copiedCodeSourceFiles' in review:
        report['copiedCodeSourceFiles'] = copied_sources
    if 'buildToolReviewPath' in review:
        tools = json.loads(package_bytes(review['buildToolReviewPath']))
        if tools['schemaVersion'] != 1:
            raise ValueError('Unsupported build-tool review version')
        groups = []
        seen_groups = set()
        for group in tools['sourceGroups']:
            if group['id'] in seen_groups:
                raise ValueError('Duplicate build-tool source group')
            seen_groups.add(group['id'])
            if ('upstreamId' in group) == ('npmUrl' in group):
                raise ValueError('Build-tool source group must identify exactly one input')
            files = (upstream[group['upstreamId']][1] if 'upstreamId' in group
                     else npm_files[group['npmUrl']])
            selected = set(group['requiredPaths'])
            for prefix in group['prefixes']:
                matches = {name for name in files if name.startswith(prefix)}
                if not matches:
                    raise ValueError(f'Build-tool source prefix is absent: {prefix}')
                selected.update(matches)
            groups.append({**group, 'files': [{'path': name, 'sha256': digest(files[name])}
                                            for name in sorted(selected)]})
        report['buildToolSources'] = {'status': tools['status'], 'sourceGroups': groups}
    if 'componentReviewPath' in review:
        profile = json.loads(package_bytes(review['componentReviewPath']))
        report['distributionComponents'] = component_report(profile, report['packages'],
                                                            upstream, package_bytes)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive', type=Path)
    args = parser.parse_args()
    data = args.archive.read_bytes()
    checksum = args.archive.with_suffix(args.archive.suffix + '.sha256')
    if not checksum.exists() or digest(data) != checksum.read_text().split()[0]:
        parser.error('Missing checksum sidecar or archive checksum mismatch.')
    files = archive_files(data)
    manifest = json.loads(files['SOURCE_MANIFEST.json'])
    for item in manifest['packageFiles']:
        if digest(files['package/' + item['path']]) != item['sha256']:
            raise ValueError('Package source checksum mismatch')
    report = build_report(manifest, files.__getitem__, lambda name: files['package/' + name])
    stored = json.loads(files['SOURCE_NOTICE_REPORT.json'])
    if report != stored:
        raise ValueError('Stored notice report differs from recomputed evidence')
    print(json.dumps(report['summary'], indent=2))
    print(report['status'])
    if report['summary']['byStatus'].get('unreviewed-missing-notice'):
        raise ValueError('New missing notices require review before release preparation')


if __name__ == '__main__':
    main()
