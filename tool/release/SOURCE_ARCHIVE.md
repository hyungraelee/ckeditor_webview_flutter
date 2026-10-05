# Preparing and rebuilding the source candidate

These are maintainer-only tools. They do not run during Flutter pub get,
application builds, or editor initialization. Python 3.9+, Node.js 20+, and npm
are required for this workflow. The verified environment is Python 3.9.6,
Node.js 23.9.0, and npm 10.9.2 on macOS; other environments are not yet verified.

## Prepare locally

From the Flutter package repository root:

```sh
python3 tool/release/prepare_sources.py
```

The command downloads inputs from pinned HTTPS registry/commit URLs and checks
npm lockfile integrity or recorded SHA-256 digests before caching them. It keeps
upstream notices, scripts, styles, icons, translations, and TypeScript sources.
The CKEditor archive excludes unused documentation, tests, samples, and generated
demo builds, including their source maps. License, notice, copyright, copying,
and acknowledgment files are retained even inside excluded directories. Additional
review sources use explicit exclusions for unrelated demos, tests, and languages;
the original vanilla-colorful, published Lodash, and color-fns archives remain intact.
Exact non-optional npm tarballs preserve the
build inputs and their original package contents. Lodash's exact ES and main publication commits, development-tag source,
a verified generator commit, and copied-code reference archives are also included.
Copied-code references do not establish an exact copied revision. The Lodash
recipe reproduces the audited ES inputs, rather than the complete npm release;
see [LODASH_GENERATION.md](LODASH_GENERATION.md). Historical React/early port
sources also preserve the reviewed conversion relationship; see
[COLOR_SOURCE_REVIEW.md](COLOR_SOURCE_REVIEW.md).

The default output is `.dart_tool/release/source-candidate.tar.gz`, accompanied
by a SHA-256 sidecar. Cache and outputs are ignored by Git and publishing and
are never Flutter runtime assets. Nothing is uploaded. Existing output paths
are rejected to preserve previous candidates. To regenerate after changes:

```sh
python3 tool/release/prepare_sources.py --offline \
  --output .dart_tool/release/source-candidate-next.tar.gz
```

Offline mode requires previously verified cached inputs and rejects missing or
corrupt ones. Without offline mode, invalid cache entries are downloaded again
and verified. Initial downloads may take time and use substantial disk space.
The notice-reviewed candidate is approximately 60 MiB compressed, reduced from
the 201 MiB full-input candidate. It contains 501 pinned inputs and omits 22 optional
platform-specific npm inputs. The fresh rebuild below verifies that those inputs
are unnecessary for this audited build. Required compiler/tool tarballs are kept
intact; the remaining size is primarily npm build dependencies. It is a separate
source release artifact, not a pub.dev upload. The initial cache still stores the
original upstream archive so its recorded provenance can be verified offline.

Package files come from an explicit set of source/documentation folders and
root files, intersected with Git's tracked/non-ignored file list. Local agent
instructions, environment files, hidden caches, build output, dependency
installation folders, and Python bytecode are excluded. Symlinks require review
instead of being followed. The manifest records each package file's digest,
the repository commit, and whether working-tree changes were included. Final
release candidates must be regenerated from the approved clean release checkout.

The archive contains:

- `package/`: the package implementation, editor assets and notices, recipes,
  lockfiles, tests/example sources, and source preparation/rebuild scripts.
- `inputs/`: original, integrity-verified npm tarballs and selected upstream sources.
- `SOURCE_MANIFEST.json`: source provenance, installation mapping, package file
  checksums, working-tree status, and unresolved release review items. Selected
  archives record the original upstream SHA-256/size, exclusion rules, retained
  file paths/digests/sizes, excluded file count, and selected archive SHA-256/size.
  Omitted optional npm inputs are listed separately; original lockfiles remain
  unchanged in `package/`.
- `SOURCE_NOTICE_REPORT.json`: recomputable evidence for the 487 npm inputs,
  targeted embedded/upstream notices, copied-code reference notices, source
  comparisons, and remaining review. See [NOTICE_REVIEW.md](NOTICE_REVIEW.md).

## Rebuild in a fresh environment

Keep the checksum sidecar next to the archive, then run:

```sh
python3 tool/release/rebuild_sources.py \
  .dart_tool/release/source-candidate.tar.gz
```

Use `--work <new-directory>` to retain the extraction at a chosen location. The
command rejects an existing destination. Verify source scripts before executing
a candidate received from someone else: checksums detect changes but are not
signatures or proof that scripts are trustworthy.

The rebuild verifies the archive, selected upstream file lists, the notice
report, and all input/package-file digests, rejects
unsafe archive paths and link members, and extracts to a new workspace. It
rewrites npm download locations only in that disposable extraction to the
preserved local tarballs. Installation uses
`npm ci --offline --ignore-scripts --omit=optional`
with a new cache; lifecycle hooks are disabled. No dependency downloads are
needed for the verified build path.

Before generation, the rebuild checks eleven copied-code source/notice files
and compares thirteen early React/port conversion initializers. The original HSV
permission remains unresolved; the comparison is not license approval.

The source regeneration step:

1. Restores original CKEditor CSS, SVG icons, and PO translation inputs from
   upstream, including theme importer resources outside the emitted JS list.
2. Generates the 438 audited CKEditor JavaScript inputs with TypeScript 5.0.4
   and upstream compiler options.
3. Runs vanilla-colorful's upstream CSS generation script, then generates its
   12 audited JavaScript inputs with TypeScript 4.8.4 and upstream options.
4. Generates the 191 audited Lodash ES modules from the 4.17.21 development
   source using the pinned generator and verifies them against the exact
   publication commit and installed npm inputs.
5. Requires every restored/generated input to equal the locked npm input,
   rebuilds with the package's webpack recipe, and compares the seven generated
   bundle/CSS/notice/metadata files to the supplied assets.

JavaScript generation uses TypeScript `transpileModule`, not a full type-checking
build of the upstream monorepo or reproduction of every upstream npm artifact.
Other dependencies use their archived npm inputs. Upstream modification sources
and original build configurations remain available; excluded test/demo trees are
not needed for this scoped rebuild. This verification is scoped to the audited
bundled editor. TypeScript aliases
are locked in `source-build/package-lock.json` and add no Flutter runtime
dependency. Generated assets stay in the extraction; repository assets are never
overwritten.

The workspace retains `SOURCE_GENERATION_REPORT.json`,
`LODASH_GENERATION_REPORT.json`, `COLOR_SOURCE_REVIEW_REPORT.json`, and
`REBUILD_REPORT.json`
with generation counts, environment, asset hashes, archive checksum, and
remaining review items. Treat a failed comparison as a release preparation
failure; do not replace the distributed bundle merely to obtain matching hashes.

## Outstanding publication review

The candidate proves a scoped source-to-bundle rebuild path, not completion of
all redistribution or corresponding-source obligations. Before publication:

- Complete provenance/notice review for vanilla-colorful's copied color-fns and
  react-colorful revisions and HSV conversion code. Its upstream acknowledgments
  and additional reference MIT notices are included. The preserved early React/port
  relationship is verified as described in [COLOR_SOURCE_REVIEW.md](COLOR_SOURCE_REVIEW.md). The cited
  [HSV conversion page](https://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c)
  is a repost and does not establish an explicit license for the copied code.
- The verified Lodash generator reproduces all audited ES inputs. Six other
  publication modules differ or are absent; do not claim a complete historical
  npm release rebuild. See [the scoped comparison](LODASH_GENERATION.md).
- Review notices and source forms of included build tools and dependency files.
  Of the eleven retained inputs without standalone notice filenames, six have
  complete embedded notices and three now have pinned upstream notices preserved.
  Two declare a license without a recovered complete notice and need upstream
  clarification. The inventory does not approve source forms or notice applicability
  for every included file. See [the targeted review](NOTICE_REVIEW.md).
  No generated candidate is automatically approved for publication.
- Regenerate from the approved release checkout, review the actual manifest and
  archive contents, retain checksums, and verify the final source rebuild.
- Publish the reviewed versioned source artifact at a persistent anonymous
  download location and add source access information alongside the package's
  bundled distribution notices before pub.dev upload.

Device behavior, supported Flutter SDKs, actual package consumption, and web/app
HTML round trips remain separate validation tasks. A 41.4.1 source archive does
not cover engines generated by consuming applications at other versions.
