# SPDX-License-Identifier: GPL-2.0-or-later
"""Exercise verification failures without GitHub or pub.dev writes."""

import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import urllib.error
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('verify_release',
    Path(__file__).resolve().parents[1] / 'tool/release/verify_release.py')
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)


def archive_bytes(files):
    result = io.BytesIO()
    with tarfile.open(fileobj=result, mode='w:gz') as bundle:
        for name, data in files.items():
            member = tarfile.TarInfo(name)
            member.size = len(data)
            bundle.addfile(member, io.BytesIO(data))
    return result.getvalue()


class VerificationTests(unittest.TestCase):
    def test_only_not_found_means_a_version_is_absent(self):
        for status in [404, 403, 500]:
            error = urllib.error.HTTPError('https://pub.dev', status, 'fixture', {}, None)
            with patch.object(verify, 'fetch', side_effect=error):
                if status == 404:
                    self.assertIsNone(verify.hosted_version('0.2.0'))
                else:
                    with self.assertRaises(urllib.error.HTTPError):
                        verify.hosted_version('0.2.0')

    def sources(self, root, commit='a' * 40, dirty=False, content=b'editor'):
        manifest = {'packageCommit': commit, 'includesWorkingTreeChanges': dirty,
                    'packageFiles': [{'path': 'assets/editor/editor.js',
                                     'sha256': hashlib.sha256(b'editor').hexdigest()}]}
        file = root / 'sources.tar.gz'
        file.write_bytes(archive_bytes({'SOURCE_MANIFEST.json': json.dumps(manifest).encode(),
                                       'package/assets/editor/editor.js': content}))
        file.with_name(file.name + '.sha256').write_text(f'{verify.digest(file.read_bytes())}  {file.name}\n')
        return file

    def test_source_manifest_requires_clean_matching_commit(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            file = self.sources(root)
            self.assertEqual(verify.verify_sources(file, 'a' * 40)['commit'], 'a' * 40)
            with self.assertRaisesRegex(ValueError, 'clean release commit'):
                verify.verify_sources(file, 'b' * 40)
            with self.assertRaisesRegex(ValueError, 'clean release commit'):
                verify.verify_sources(self.sources(root, dirty=True), 'a' * 40)

    def test_source_file_and_sidecar_corruption_reject(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            with self.assertRaisesRegex(ValueError, 'file digest'):
                verify.verify_sources(self.sources(root, content=b'different'), 'a' * 40)
            file = self.sources(root)
            file.with_name(file.name + '.sha256').write_text('wrong')
            with self.assertRaisesRegex(ValueError, 'sidecar'):
                verify.verify_sources(file, 'a' * 40)

    def hosted(self, root, files):
        (root / 'pubspec.yaml').write_bytes(b'version: 0.2.0\n')
        data = archive_bytes(files)
        record = {'version': '0.2.0',
                  'archive_url': 'https://pub.dev/api/archives/ckeditor_webview_flutter-0.2.0.tar.gz',
                  'archive_sha256': verify.digest(data)}
        return record, data

    def test_hosted_bytes_must_match_checkout_and_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            record, data = self.hosted(root, {'pubspec.yaml': b'version: 0.2.0\n'})
            with patch.object(verify, 'fetch', return_value=data), patch.object(verify, 'package_files', return_value=['pubspec.yaml']):
                self.assertEqual(verify.verify_hosted(record, root)['matchedReleaseFiles'], 1)
                (root / 'pubspec.yaml').write_bytes(b'version: 0.3.0\n')
                with self.assertRaisesRegex(ValueError, 'differs from release'):
                    verify.verify_hosted(record, root)
                record['archive_sha256'] = 'wrong'
                with self.assertRaisesRegex(ValueError, 'metadata'):
                    verify.verify_hosted(record, root)

    def test_hosted_missing_or_private_files_reject(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            for files in [{}, {'pubspec.yaml': b'version: 0.2.0\n', '.agents/skills/test/SKILL.md': b'private'}]:
                record, data = self.hosted(root, files)
                with patch.object(verify, 'fetch', return_value=data), patch.object(verify, 'package_files', return_value=['pubspec.yaml']):
                    with self.assertRaises(ValueError):
                        verify.verify_hosted(record, root)

    def test_unexpected_archive_host_rejects_before_downloading(self):
        with tempfile.TemporaryDirectory() as directory:
            record, _ = self.hosted(Path(directory), {})
            record['archive_url'] = 'https://example.com/package.tar.gz'
            with patch.object(verify, 'fetch', side_effect=AssertionError('Do not fetch an unexpected URL')):
                with self.assertRaisesRegex(ValueError, 'Unexpected'):
                    verify.verify_hosted(record, Path(directory))


if __name__ == '__main__':
    unittest.main()
