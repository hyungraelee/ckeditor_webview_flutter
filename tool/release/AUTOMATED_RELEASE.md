# Automated releases

Releases start when a same-repository `develop` → `main` PR named
`Release vX.Y.Z` is merged. The merge commit supplies the package version,
editor assets, source recipes, and release notes for all subsequent steps.
The initial manual `0.1.0` release remains unchanged.

## One-time configuration

On the package's [pub.dev Admin page](https://pub.dev/packages/ckeditor_webview_flutter/admin),
enable GitHub Actions publishing with:

- Repository: `hyungraelee/ckeditor_webview_flutter`.
- Tag pattern: `v{{version}}`.
- Allow both `push` and `workflow_dispatch` events.
- A GitHub Actions environment is optional; the current workflows do not
  require one. If enabled later, configure the same environment in the
  publishing job and pub.dev.

GitHub Actions must be enabled. Repository rules must permit the tag job's
`GITHUB_TOKEN` to create new version tags and dispatch workflows. It requires
`contents: write` and `actions: write`. The publication job requires
`contents: write` for release assets and `id-token: write` for temporary
pub.dev OIDC credentials. No personal Google credentials or PAT are required.

See the [Dart automated publishing guide](https://dart.dev/tools/pub/automated-publishing)
and the [pub.dev maintainer's workflow_dispatch explanation](https://github.com/dart-lang/pub-dev/issues/8507).

## Prepare a release

Calculate the next version from changes since the previous release. Apply the
highest change level once, rather than incrementing for each merged change.
Update the following through a preparation PR into `develop`:

- `pubspec.yaml`: the stable `X.Y.Z` version.
- `CHANGELOG.md`: exactly one `## X.Y.Z` section, with editor-facing changes.
  If editor behavior did not change, say so without inventing improvements.
- `README.md` and `THIRD_PARTY_NOTICES.md`: source and checksum URLs for the
  new version, using the names below.

```text
Tag: vX.Y.Z
Source archive: ckeditor_webview_flutter-X.Y.Z-sources.tar.gz
Checksum: ckeditor_webview_flutter-X.Y.Z-sources.tar.gz.sha256
```

Keep the package's versioned source URLs aligned with the published package;
do not rewrite them inside the publication job. Preserve older release assets.
The release workflow reads the matching CHANGELOG section, without generating
notes from commit titles or copying development-only changes into release notes.
Source links and checksum metadata are appended separately.

Create the `develop` → `main` PR with the exact title `Release vX.Y.Z` and include
`Closes #N` for each issue completed by that release. Issues with remaining work
should only be referenced. Review relevant Android/iOS device behavior before
merging; automated tests do not replace device checks.

The supported automation currently handles stable versions only. Prereleases
and build metadata require a separate policy and implementation.

## Workflows

`ci.yml` checks package and example analysis, Flutter tests, Node tests, Python
verification tests, and publication dry-run on Flutter 3.27.0 and 3.44.6.
Release PRs additionally check their CHANGELOG and source links.

`tag-release.yml` reacts to a merged release PR. It verifies the title/version
and exact merge commit, creates a lightweight tag, and dispatches `release.yml`
with the tag ref. A matching existing tag is reused; a different commit fails
without changing the tag. The tag job can be rerun after a dispatch failure.

`GITHUB_TOKEN`-created tag pushes do not trigger another push workflow, so the
explicit dispatch is necessary. See [GitHub's workflow trigger rules](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#triggering-a-workflow-from-a-workflow).
Both entry points serialize publication by tag.

`release.yml` checks that the tag points to the matching merged release PR and
that the checkout is clean. It then:

1. Analyzes/tests the package and example and runs publication dry-run.
2. Generates the source archive from the same clean commit, audits notices,
   verifies its manifest/checksum, and rebuilds the editor offline.
3. Creates a draft GitHub release, uploads sources/checksum, publishes the
   release, and verifies both downloads anonymously against the local bytes.
4. Checks whether the package version is already present on pub.dev.
5. Configures temporary OIDC credentials and uploads with
   `flutter pub publish --force` only if the version is absent.
6. Downloads the hosted package and compares non-hidden tracked package,
   editor, tool, test, and example files with the release checkout. It also
   checks the pub.dev archive digest and rejects private/cache files.
7. Retains available JSON verification reports as Actions artifacts for
   90 days. Source archives/checksums remain GitHub release assets.

The source job uses macOS 14, Node 23.9.0 and npm 10.9.2 to preserve the existing
rebuild baseline. These versions are explicit; changing the baseline requires
rebuild verification. The source cache is populated from pinned URLs and
verified integrity records. Rebuilding the generated archive uses offline
inputs in a separate workspace and never rewrites the publication checkout.

## Failure and retry

- Any validation, rebuild, or anonymous download failure prevents package upload.
- Existing source assets must match the generated bytes; they are never
  overwritten with `--clobber`. Conflicting assets stop the workflow for review.
- If source publication succeeds but package upload fails, rerun the failed
  release workflow. It reuses matching assets.
- If the package is already published, a retry verifies its bytes and skips
  the upload. A mismatch fails; correcting published code requires a new version.
- Dispatch manually with the existing version tag selected as the ref.
  Dispatching on `main` is intentionally skipped. A direct version-tag push
  also works when it identifies the matching merged release PR.
- Do not move or delete published tags to retry a failed deployment.

## Validation scope

Local helper tests mock GitHub writes and exercise rejected PRs/tags, retry
behavior, source conflicts, manifest checks, and hosted byte verification.
They do not establish GitHub token permissions, pub.dev account configuration,
or a successful production upload. Those are verified on the first approved
automated release; dry-run never publishes.

Source provenance, rebuild scope, and native-device validation are documented in
[SOURCE_ARCHIVE.md](SOURCE_ARCHIVE.md) and the [source release overview](README.md).
The [manual release record](MANUAL_RELEASE.md) remains available for the original
release and manual recovery.
