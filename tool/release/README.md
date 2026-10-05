# Bundled editor source and release audit

This is a maintainer record for the initial 0.1.0 release candidate. It covers
only the bundled CKEditor 41.4.1 editor. It is not a complete corresponding-source
archive or a certification of GPL compliance. A local source candidate and a
scoped source-to-bundle rebuild are now available; final provenance/notice review
and a public release download location remain pending. See
[SOURCE_ARCHIVE.md](SOURCE_ARCHIVE.md) for preparation commands and limits.
The targeted notice findings and remaining clarifications are in
[NOTICE_REVIEW.md](NOTICE_REVIEW.md). Source candidates also include a recomputable
notice inventory tied to pinned tarballs and reference source digests.

## Verified build provenance

Baseline: develop commit `0fd089d`. Build environment: Node.js 23.9.0,
npm 10.9.2, webpack 5.91.0, production mode, macOS.

The build recipe and exact package lock were copied into a fresh temporary
`tool/ckeditor_build/` directory, with a separate `assets/editor/` output.
`npm ci --no-audit --no-fund` installed the locked dependencies. A production
webpack build and `write-build-info.cjs` reproduced the following existing
files byte for byte:

- `ckeditor.js` and `ckeditor.css`
- `ckeditor.js.LICENSE.txt` and `CKEDITOR-LICENSE.txt`
- `build-info.json`

The hashes and lockfile digest are recorded in
[bundled-source-inventory.json](bundled-source-inventory.json). The notice writer
also copies Lodash's license and the audited color UI licenses/acknowledgments
from the installed packages. It does not change the editor bundle or CSS.

An emitted-chunk module inventory identified 30 npm packages: 25 CKEditor
packages at 41.4.1 and five MIT dependencies. It includes dependent and nested
concatenated modules and CSS modules, excluding modules that occur only in the
unemitted compilation graph. Webpack runtime helpers and the local entry point
are recorded separately in the module identifier list. An identifier is not
necessarily a complete file emitted verbatim after optimization.

[bundled-module-identifiers.json](bundled-module-identifiers.json) records the
identifiers with local absolute paths removed. The package inventory records
exact versions, npm tarball locations, lockfile integrity values, and repository
information. It does not include every build-tool dependency; the full npm lock
remains necessary for reconstructing the build environment.

| MIT dependency | Version | Preserved notice |
| --- | --- | --- |
| lodash-es | 4.17.21 | `assets/editor/LODASH-LICENSE.txt` |
| vanilla-colorful | 0.7.2 | `assets/editor/THIRD_PARTY_LICENSES.txt` |
| color-parse | 1.4.2 | `assets/editor/THIRD_PARTY_LICENSES.txt` |
| color-convert | 2.0.1 | `assets/editor/THIRD_PARTY_LICENSES.txt` |
| color-name | 1.1.4 | `assets/editor/THIRD_PARTY_LICENSES.txt` |

The inventory is tied to these asset and lockfile hashes. Repeat the audit when
changing the bundle, build recipe, or dependencies. Do not infer enabled editor
features from the entire lockfile: it includes packages outside this bundle.

## Preferred modification sources

The exact CKEditor tag `v41.4.1` resolves to commit
`c3319030d8d3d0291b794f24d40c0970c99c9628`. Its inspected source archive includes
TypeScript files, styles, icons, translations, package manifests, TypeScript
configurations, and release/build scripts. For example, upstream
`packages/ckeditor5-core/src/command.ts` corresponds to the npm-level JavaScript
input. The npm packages alone must not be assumed to contain all preferred
modification sources.

Vanilla-colorful 0.7.2's npm publication metadata identifies commit
`d227133e466cc0be720ae0fda775a0d3a927679e`. Its inspected repository archive
provides TypeScript sources and the style generation/build scripts; the npm
package provides generated JavaScript and source maps.

The downloaded archives' commit URLs, SHA-256 digests, and byte sizes are in the
inventory. The source preparation tools verify these originals, then select
CKEditor sources without unused documentation, tests, samples, or generated
demo builds. Notices and build/modification inputs are preserved, and the source
manifest records the selection and original provenance. No project source
release has been published. The notice-reviewed candidate is approximately 60 MiB,
including npm build inputs; do not add it to Flutter runtime assets. Keep source
distribution separate from the editor loaded in the WebView.

The initial audit identified the following checks. The source archive follow-up
now verifies the audited TypeScript/CSS generation and the published Lodash ES
modules; historical generator and copied-code review remains open. See
[SOURCE_ARCHIVE.md](SOURCE_ARCHIVE.md) for the current status:

- Confirm and document the TypeScript/style build path to the exact npm-level
  inputs used in the matched bundle. The npm-to-bundle rebuild was verified;
  the follow-up verifies 438 CKEditor and 12 vanilla-colorful JavaScript inputs
  with upstream TypeScript options, without a complete upstream type-checking
  release build.
- Resolve Lodash ES module generation inputs and preserve the appropriate
  modification sources and generator scripts. An ES module tarball or upstream
  repository link alone does not establish this chain.
- Review vanilla-colorful's copied-code origins in `ACKNOWLEDGMENTS`:
  react-colorful, `@swiftcarrot/color-fns`, and the cited HSV conversion code.
  Preserve any additional applicable notices and sources in the release.
- Review licenses and source requirements for build tools or other files that
  will be included in the source distribution. Installed dependency directories
  are not a reviewed source archive.

## Release source distribution plan

Prepare one versioned source archive alongside the public GitHub release. Its
contents should include the package's preferred sources and local changes,
this build recipe and lock, exact third-party modification sources, applicable
notices, required generation/build inputs, and documented rebuild instructions.
Retain the exact npm inputs and integrity records for comparison with generated
files; include the source forms above rather than substituting generated files.
Exclude credentials, local agent instructions, OS/editor artifacts, and caches.

Verify the archive by extracting it into a fresh environment, rebuilding from
its documented source inputs, and comparing with the release bundle. Record the
environment, asset hashes, and archive checksum. If output differs, investigate
before claiming that the archive corresponds to the distributed editor.

Before uploading to pub.dev, publish the source archive at a persistent release
location and put a direct source-download link next to the bundled distribution
information in README and THIRD_PARTY_NOTICES. Verify anonymous download access
and the archive checksum. A GitHub auto-generated source snapshot of this
Flutter repository does not include the third-party TypeScript sources.

This is a proposed distribution arrangement, not an assertion that an unpublished
archive or upstream links satisfy the license. Review the actual source contents
and access arrangement against GPL v2 section 3 before release:
[GPL v2](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html) and the
[GNU GPL v2 FAQ](https://www.gnu.org/licenses/old-licenses/gpl-2.0-faq.html#SourceAndBinaryOnDifferentSites).

The optional builder resolves other engine versions in consuming applications.
This inventory and any 41.4.1 source archive do not cover those generated editors
or establish GPL compliance for downstream applications.

## Publication file review

Run `fvm flutter pub publish --dry-run` from the package root and inspect its
actual file list; `.pubignore` replaces `.gitignore` for publishing exclusions.
Preserve `lib/`, `bin/`, editor assets and notices, both editor build tools and
their inputs, package documentation, example sources, and test sources.
Exclude `.git/`, hidden SDK/cache directories, `node_modules`, build output,
credentials, and `AGENTS.md`/`agents.md`. Do not exclude a JavaScript file solely
because it has a `.js` extension: several are required package inputs.

The baseline dry-run passed with zero warnings and a 351 KB compressed archive.
Required editor assets, build scripts and locks were present. Local instructions
and node_modules were absent. Repeat the dry-run after adding the audit records
and license notices, and again on the final release checkout.

With the added notices and audit records, the package snapshot dry-run passed
with zero warnings and a 366 KB compressed archive. The working-checkout
dry-run reported only the expected uncommitted-file warning. New license and
audit files were included; local instructions, dependencies, caches, and the
large upstream audit downloads were absent. No upload was performed.

After adding source preparation/rebuild tools and compact source selection, a
package snapshot dry-run passed with zero warnings and a 378 KB compressed
archive. The separate source candidate was reduced from 201 MiB to 59 MiB;
its fresh offline rebuild reproduced all seven generated editor assets byte for
byte. Runtime Dart, editor assets, and the original build recipe were unchanged.

The notice review adds original MIT reference notices for acknowledged copied
color UI code; the notice writer retains them during a rebuild. The JS/CSS bundle
and runtime Dart remain unchanged. Two build inputs still need complete notice
clarification, and copied-code/historical-generation review remains open. See
[NOTICE_REVIEW.md](NOTICE_REVIEW.md) for evidence and reproduction commands.
The notice-review snapshot dry-run passed with zero warnings and an approximately
388 KB compressed package. Fresh offline source regeneration/rebuild matched
the expanded notice file and all other generated outputs; the separate source
candidate remains approximately 60 MiB.

The next source-generation step replaces the older Lodash generator reference
with a pinned 4.17.21 generator and reconstructs all 191 audited ES modules
from the preserved development source. See [LODASH_GENERATION.md](LODASH_GENERATION.md)
for exact inputs, comparison scope, and remaining publication differences.

A dry-run does not upload a package or verify corresponding-source availability,
third-party license completeness, native device behavior, or HTML compatibility.
Android/iOS example checks, actual packaged-file consumption, SDK compatibility,
web/app round trips, release document/version review, and source publication must
still be completed before a public release.
