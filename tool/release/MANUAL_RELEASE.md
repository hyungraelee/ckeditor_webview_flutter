# Manual release: 0.1.0

The first pub.dev release is published manually. This procedure follows the
[Dart publishing guide](https://dart.dev/tools/pub/publishing). It prepares the
package and separate bundled-editor source distribution from the same commit.

## Release identity

| Item | Value |
| --- | --- |
| Package | `ckeditor_webview_flutter` |
| Package version | `0.1.0` |
| Bundled engine | `41.4.1` |
| Git tag | `v0.1.0` |
| Source archive | `ckeditor_webview_flutter-0.1.0-sources.tar.gz` |
| Checksum | `ckeditor_webview_flutter-0.1.0-sources.tar.gz.sha256` |

Source asset URLs, already staged in README and THIRD_PARTY_NOTICES:

- [Archive](https://github.com/hyungraelee/ckeditor_webview_flutter/releases/download/v0.1.0/ckeditor_webview_flutter-0.1.0-sources.tar.gz)
- [Checksum](https://github.com/hyungraelee/ckeditor_webview_flutter/releases/download/v0.1.0/ckeditor_webview_flutter-0.1.0-sources.tar.gz.sha256)

These are planned release locations, not currently verified public downloads.
Do not upload the package until both URLs serve the reviewed files anonymously.
Do not substitute GitHub's automatic source snapshot for this archive.

## 1. Validate the release changes

Review package metadata, the 0.1.0 changelog, consumer examples, and publication
files. The package and example retain Flutter 3.27.0 / Dart 3.6.0 minimums.

```sh
fvm flutter pub get
fvm flutter analyze
fvm flutter test
node --test test/*_test.cjs
cd example
fvm flutter pub get
fvm flutter analyze
cd ..
fvm flutter pub publish --dry-run
```

Review the actual dry-run file list. Required local editor assets, notices,
builder scripts/locks, and documentation must be present. Local instructions,
credentials, node_modules, build output, and source archives must be absent.
A working-tree warning is expected during preparation; the final checkout must
be clean. Confirm native checks appropriate to runtime changes using the
[example checklist](../../example/README.md#device-checks). Keep SDK/build checks,
mock tests, native-device checks, and actual web custom-build compatibility
claims distinct.

## 2. Integrate and identify the release commit

After the release changes reach `develop`, integrate `develop` into `main`
through a release PR. Create the `v0.1.0` tag on the resulting release commit.
Use that clean checkout for source generation and the pub.dev upload. Record
its full commit SHA and verify the tag resolves to it. If code changes after
validation, repeat the affected checks and regenerate the artifacts.

## 3. Generate and verify sources

From that clean release checkout, with pinned inputs already cached:

```sh
python3 tool/release/prepare_sources.py --offline \
  --output .dart_tool/release/ckeditor_webview_flutter-0.1.0-sources.tar.gz
python3 tool/release/audit_source_notices.py \
  .dart_tool/release/ckeditor_webview_flutter-0.1.0-sources.tar.gz
python3 tool/release/rebuild_sources.py \
  .dart_tool/release/ckeditor_webview_flutter-0.1.0-sources.tar.gz
```

Omit `--offline` only when populating the verified source cache. Existing output
paths are rejected; preserve reviewed artifacts and choose a new candidate path
for further work. See [SOURCE_ARCHIVE.md](SOURCE_ARCHIVE.md) for requirements and
rebuild scope.

Inspect `SOURCE_MANIFEST.json`: `packageCommit` must identify the release commit
and `includesWorkingTreeChanges` must be false. Retain the archive/checksum and
rebuild report. `matchedAssets` lists seven regenerated outputs;
`preservedAssets` lists the three hand-authored editor assets checked unchanged.
An older working-tree candidate must not be relabeled as the final source file.

## 4. Publish the source assets

Create the GitHub release for `v0.1.0`. Attach the archive and its `.sha256`
sidecar under the exact names above. Release notes should identify the package
and engine versions, source download, checksum, and relevant validation limits.
Keep these assets accessible for this distributed version.

Download both files without authentication into a fresh directory and verify:

```sh
shasum -a 256 -c ckeditor_webview_flutter-0.1.0-sources.tar.gz.sha256
```

Compare the downloaded checksum with the locally reviewed checksum, and ensure
the README and notice links resolve to those exact assets. An uploaded draft or
an authenticated-only download does not establish anonymous source access.

## 5. Publish to pub.dev

From the same clean release checkout:

```sh
fvm flutter pub publish --dry-run
fvm flutter pub publish
```

Run the actual publish command only after the final file list and public source
assets have been checked. Complete Google-account authentication when prompted
and confirm the package upload. After success, inspect the pub.dev README,
changelog, version, license, platform metadata, and source links. Verify a fresh
consuming app resolves `ckeditor_webview_flutter: 0.1.0` from pub.dev and can load
the packaged editor; a prior path-dependency check does not verify the hosted
package. Keep the release artifacts and their provenance for later releases.
