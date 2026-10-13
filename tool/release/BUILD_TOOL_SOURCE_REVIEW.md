# Scoped build-input notice and source-form review

This maintainer record covers the remaining standalone-notice gaps and selected
build tool source forms in the bundled CKEditor 41.4.1 candidate. It does not
certify the entire dependency tree or complete corresponding-source compliance.
Runtime Dart, editor assets, original bundle recipes, and project licensing are
unchanged. No dependency is upgraded and no upstream author is contacted.

## Boolbase notice recovered

The original [license-addition commit](https://github.com/fb55/boolbase/commit/be0bcd8a4e917a0a5895e95b523fbbed05a64871)
preserves the ISC text naming Felix Boehm and still declares boolbase 1.0.0.
Its `index.js` is byte-identical to the locked npm input. The commit is preserved
in `source-inputs.json`; `notice-review.json` pins the original LICENSE digest
and the npm/upstream implementation comparison. No owner, year, or permission
text is invented. The archive retains the original upstream notice, while the
npm tarball remains intact.

The notice inventory now has four targeted upstream notices, six embedded
notices, 476 inputs with notice files, and one declaration-only input across
487 distinct npm tarballs. The historical npm gitHead remains unavailable; the
same-version implementation comparison does not identify a unique npm release
commit. It does establish the recorded byte relationship to the preserved
upstream source and notice.

## Acorn reference remains distinct

The [later notice-addition commit](https://github.com/xtuc/acorn-import-attributes/commit/2c7059709cc529d81194c2d7057c181f4000e375)
contains an original MIT notice naming Sven Sauleau. It belongs to the renamed
acorn-import-attributes project at version 1.9.1. Between the locked assertions
1.9.0 gitHead and that commit, the source changes the keyword, exported parser
plugin, AST properties, and dynamic-import expression handling.

The later archive and notice are retained as references. They are not substituted
for a recovered notice applicable to the earlier changed implementation.
Acorn-import-assertions 1.9.0 remains declaration-only in the inventory, with
notice applicability unresolved. This finding does not conclude that it is
unlicensed. Clarification or a separately reviewed build-input change remains
possible; this phase performs neither upstream contact nor dependency replacement.

## Source forms inspected

[build-tool-review.json](build-tool-review.json) records seven scoped source
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
| Later acorn notice | Original MIT text, changed source, metadata at the pinned later commit | Reference only; applicability to assertions 1.9.0 unresolved |

Compiler repositories exclude tests, documentation, and samples using recorded
selection rules with notices preserved. Original `lib/` bootstrap/distribution
files, compiler modification sources, scripts, and other build inputs remain
available. The source candidate consequently grows from about 60 MiB to about
88 MiB; it is separate from Flutter runtime assets and the pub.dev package.
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

## Remaining release work

Acorn notice applicability, original HSV permission and exact copied revisions,
compiler bootstrap, and exhaustive transitive build-tool source/notice review
remain open. The selected source groups do not cover all 487 npm inputs or
establish redistribution terms for every embedded component. Final source
selection and applicability must be reviewed before publication.

Regenerate from the approved clean release checkout, verify final source/bundle
checks, and provide persistent anonymous source downloads. Device/SDK/package
consumption and actual web/app HTML round trips remain separate validation.
Nothing in this workflow uploads a source archive or publishes to pub.dev.
