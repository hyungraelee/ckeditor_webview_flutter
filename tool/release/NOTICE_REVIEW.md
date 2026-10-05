# Source candidate notice review

This maintainer review covers the pinned inputs of the bundled CKEditor 41.4.1
source candidate. It records preserved evidence and remaining publication work;
it is not legal approval or a complete review of every build tool's source form.
Consumers do not run these tools.

## Reproduce the inventory

```sh
python3 tool/release/prepare_sources.py --offline \
  --output .dart_tool/release/source-candidate-notice-review.tar.gz
python3 tool/release/audit_source_notices.py \
  .dart_tool/release/source-candidate-notice-review.tar.gz
```

The preparation command includes `SOURCE_NOTICE_REPORT.json` in the archive.
The audit command recomputes it from preserved tarballs and package files,
checks the recorded notice/source digests, and rejects differing evidence or
new unreviewed inputs without notice files. Both commands use local inputs;
only preparation without `--offline` downloads pinned archives.

The report inventories 485 distinct npm tarballs. A notice filename means a
file was preserved, not that every embedded component, term, or source obligation
has been approved. License declarations are reported separately from full
notices. An unchanged audited unresolved input remains visible in the report;
successful execution does not approve it for publication.

## Eleven inputs without standalone notice files

The original scan looked only at filenames. Inspecting exact locked inputs
found the following evidence, pinned in [notice-review.json](notice-review.json).
All npm tarballs remain intact; embedded notices are never replaced.

| Input | Evidence retained | Status |
| --- | --- | --- |
| `agent-base` 6.0.2 | Complete MIT text/copyright in README | Embedded notice |
| `glob-to-regexp` 0.4.1 | Complete BSD-2-Clause text/copyright in README | Embedded notice |
| `https-proxy-agent` 5.0.1 | Complete MIT text/copyright in README | Embedded notice |
| `http-proxy-agent` 4.0.1 | Complete MIT text/copyright in README | Embedded notice |
| `imurmurhash` 0.1.4 | Complete MIT text/copyright in README | Embedded notice |
| `esrecurse` 4.3.0 | Complete BSD-2-Clause header in `esrecurse.js`; README also retains terms | Embedded notice |
| `saxes` 5.0.1 | Full upstream LICENSE, including inherited sax/XML notices, at the v5.0.1 tag | Upstream notice preserved |
| `blurhash` 2.0.5 | Wolt MIT notice and TypeScript sources at the 2.0.5 version-bump commit | Upstream notice preserved |
| `@tootallnate/once` 1.1.2 | Full MIT notice from the upstream license-addition commit; its 1.1.2 TypeScript source matches the npm gitHead | Upstream notice preserved |
| `acorn-import-assertions` 1.9.0 | npm/gitHead package metadata and README declare MIT without complete notice | Upstream clarification pending |
| `boolbase` 1.0.0 | npm metadata declares ISC; inspected same-version upstream also lacks complete notice | Upstream clarification pending |

Do not fabricate a copyright owner/year or treat an SPDX declaration as a
recovered original notice. Obtain upstream clarification or review an appropriate
build-dependency replacement for the two pending inputs before source release.
This record does not conclude that they are unlicensed.

Exact commit URLs and archive hashes are in [source-inputs.json](source-inputs.json).
The audit verifies six blurhash library TypeScript files against the npm source
map's embedded source content. The matching upstream archive also preserves its
build configuration and notice; other-language implementations and demo assets
are excluded. Saxes's source, configuration, author list, and full notice are
preserved without unused examples/test fixtures. Once's later license-addition
commit still declares version 1.1.2; its TypeScript source is byte-identical to
the npm gitHead source, and the audit repeats that comparison. These three
packages are build inputs, not modules in the emitted editor inventory.

## Acknowledged copied color UI code

Vanilla-colorful's original ACKNOWLEDGMENTS names react-colorful, color-fns,
and an HSV conversion implementation. In addition to the existing notices,
the bundled notice file and its writer now preserve original MIT texts for:

- react-colorful's 4.0.2 reference commit, copyright Vlad Shilov.
- color-fns's existing reference commit, copyright pqx Limited.

The original texts are in [notices/](notices/); their exact upstream digests and
package-file copies are checked by the audit. These references do not establish
the exact historical copied revisions. Vanilla-colorful's own license text
and acknowledgments remain verbatim, and the editor JS/CSS remain unchanged.

The cited [HSV conversion page](https://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c)
reposts code from an earlier site but does not establish an explicit license.
Preserving the acknowledgment does not resolve that permission question. Do not
substitute a different algorithm or claim clarified permission without review.

## Lodash source and generator evidence

The published Lodash ES and main npm gitHead sources remain preserved. The
development tag `4.17.21` is also pinned, including modification sources and
`lib/` generation scripts; unused docs/tests/demo output/vendor directories
are excluded with notice files retained. Its `lodash.js` is byte-identical to
the main npm publication source, and the audit repeats that comparison.

The [official custom-build documentation](https://lodash.com/custom-builds)
describes modularized ES output. The archived npm `lodash-cli` 4.17.5 reference
pins Lodash 4.17.5; it must not be treated as a verified 4.17.21 generator recipe.
Historical ES generation remains unresolved. The existing rebuild still
verifies the 191 audited unminified ES inputs directly against their exact
publication commit; this phase does not execute the generator reference.

## Remaining publication work

Complete the two upstream notice clarifications, copied-code revision/HSV
permission review, historical Lodash generation review, and build-tool source
form/notice applicability review. Regenerate from the approved release checkout,
verify the source rebuild, then publish and verify persistent anonymous source
download access. Device/SDK/package-consumption and HTML round trips remain
separate checks. No source artifact or pub.dev package is uploaded by these tools.

## Validation

On the documented macOS environment, the offline candidate contains 497 pinned
inputs. The recomputed notice inventory reports 474 npm inputs with notice files,
six targeted embedded notices, three targeted upstream notices, and two
declaration-only inputs. Blurhash's six library sources, Lodash's development and
publication source, and Once's same-version sources compare byte for byte.

Fresh offline regeneration/rebuild reproduces all seven supplied generated
assets, including the expanded notice file. The editor JS/CSS and runtime Dart
remain byte-identical to the merged baseline; existing vendor notices and the
project GPL LICENSE are unchanged. Manual negative checks reject changed input
digests, reviewed notice digests, and copied-notice bytes, and flag newly missing
notice evidence. Python/Node/JSON syntax and documentation checks passed; upstream
license whitespace is preserved verbatim when reviewing diffs.

A package snapshot dry-run passed with zero warnings, approximately 388 KB
compressed. Source candidates, caches, bytecode, dependency installations, and
local instructions were absent. Source candidates remain approximately 60 MiB
and are separate local artifacts.
