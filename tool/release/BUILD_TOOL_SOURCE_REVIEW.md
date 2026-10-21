# Build-tool sources and CLI generation

The source archive retains the build-tool sources, original notices, and
configuration used by the bundled CKEditor 41.4.1 rebuild.

Boolbase's original ISC notice is pinned to its
[license-addition commit](https://github.com/fb55/boolbase/commit/be0bcd8a4e917a0a5895e95b523fbbed05a64871).
Its `index.js` matches the locked 1.0.0 npm input byte for byte.
The acorn supplemental notice and maintainer statement are recorded in
[NOTICE_REVIEW.md](NOTICE_REVIEW.md#acorn-supplemental-notice).

## Source forms inspected

[build-tool-review.json](build-tool-review.json) records eight scoped source
file groups. The notice auditor enumerates their source paths and digests in
`SOURCE_NOTICE_REPORT.json`, requires expected source/configuration/notice files,
and ties them to the preserved archive bytes.

| Input | Source form and evidence | Scope limit |
| --- | --- | --- |
| TypeScript 5.0.4 | Official v5.0.4 commit `3b45f4db12bbae97d10f62ec0e2d94858252c5ab`; compiler TypeScript, scripts, manifests/lock, Herebyfile, original Apache notice and third-party text | Compiler bootstrap and exact npm compiler generation not reproduced |
| TypeScript 4.8.4 | Official v4.8.4 commit `a614119c1921ca61d549a7eee65c0b8c69c28752`; compiler TypeScript, scripts, manifests/lock, Gulpfile, copyright and original notices | Compiler bootstrap and exact npm compiler generation not reproduced |
| webpack-cli 5.1.4 and locked configtest/info/serve components | CLI npm gitHead `e07f0e58df103011435524d757102534b75a6796`; monorepo TypeScript, compiler configuration, lock, original MIT text | Nine JavaScript inputs reproduced; declaration generation and full release build excluded |
| webpack 5.91.0 | npm `lib/` JavaScript and original MIT notice retained | Generated helpers/schema preparation and complete upstream generation remain outside this comparison |
| Terser 5.51.2 | npm unbundled `lib/` and `main.js`, property inputs, original BSD notice retained alongside its generated bundle | Historical Rollup output reproduction not performed |
| CSSO 5.0.5 | npm `lib/` ES module modification sources and original MIT notice retained alongside generated CommonJS/distribution outputs | Full upstream ES-to-CJS/distribution generation not reproduced |
| CKEditor developer tools 39.7.0 | Official v39.7.0 source commit `15c6c4290c794717f03021bf4cf3ee8a511ca942`, original GPL text, package/build metadata, and translation/utils JavaScript sources | All 29 distributed library JS files match npm inputs; other developer-tool packages are not independently release-rebuilt |
| Later acorn notice | Original MIT text, changed source, metadata at the pinned later commit; subsequent pre-release owner clarification retained | See [notice inventory](NOTICE_REVIEW.md#acorn-supplemental-notice); the renamed implementation differs from 1.9.0 |

Compiler repositories exclude tests, documentation, and samples using recorded
selection rules with notices preserved. Original `lib/` bootstrap/distribution
files, compiler modification sources, scripts, and other build inputs remain
available. The source archive is approximately 88 MiB and is distributed
separately from the Flutter package.
The compilers' own upstream locks are retained as source/build evidence, but
their additional development dependencies are not a verified offline bootstrap
recipe. This archive's documented offline build uses the preserved npm compilers.

## CLI generation verification

The offline rebuild runs `verify_build_tool_sources.cjs` after isolated npm
installation. It reads the upstream CLI compiler options, uses the already
locked TypeScript 4.8.4 alias, and transpiles nine selected CLI/component sources.
All nine outputs must equal their locked npm JavaScript inputs byte for byte
before they are used in the ensuing editor build. Reviewed application source
is not executed by this comparison. The ensuing build executes the verified CLI.

The checked files are six CLI modules (bootstrap, index, CLIPlugin, types,
dynamic-import loader, and main CLI) plus the configtest, info, and serve entry
modules. TypeScript 5.0.4 produces a different export-placement sequence for
CLIPlugin; the recipe uses 4.8.4 without normalizing or patching that difference.
This is a reproducible scoped recipe, not proof of the historical compiler used
by the upstream publisher. Type checking, declarations, and complete release
artifact generation are not claimed.

`BUILD_TOOL_SOURCE_REPORT.json` records source/output digests and comparison
scope. Existing CKEditor, vanilla-colorful, Lodash, and color relationship checks
remain in place. Older candidates lacking the new review fields and verifier
remain compatible with the updated notice auditor/rebuild entry point.

## Verification scope

The comparisons cover the listed source groups and selected JavaScript inputs.
They do not reproduce compiler bootstrap, all transitive tool releases, or
complete historical npm publications. Release preparation uses the clean release
checkout and verifies the resulting source archive and generated editor assets.
See [SOURCE_ARCHIVE.md](SOURCE_ARCHIVE.md) for the commands and report files.
