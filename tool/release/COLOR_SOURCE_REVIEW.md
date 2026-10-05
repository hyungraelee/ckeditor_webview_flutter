# Copied color UI source relationships

This maintainer review narrows the source relationships acknowledged by
vanilla-colorful 0.7.2. It preserves historical modification sources and
recomputable comparisons without changing the distributed editor. It does
not establish permission for the original HSV conversion implementation or
identify a unique historical commit selected by the person who copied it.

## Preserved source chain

| Input | Pinned source | Evidence |
| --- | --- | --- |
| react-colorful | `7dd80f931f914f8bea09b38ef98298d364786cb2`, TypeScript conversion, 2020-08-29 | Conversion source, original MIT notice, and copied-code acknowledgments |
| Early vanilla-colorful port | `261e1c227b8dc04753e8cc04640b934d433c2d91`, original MIT notice addition, 2020-08-31 | Conversion source, original MIT notice, and acknowledgments |
| color-fns | `57ade16e13411abdc16b43926fa144e73332b1e4`, 3.2.0, 2020-08-11 | Flow modification sources `hex2rgb.js` and `rgb2hex.js`, original MIT notice |
| Distributed vanilla-colorful | `d227133e466cc0be720ae0fda775a0d3a927679e`, 0.7.2 | Released TypeScript conversion source and acknowledgments, already used by the verified source rebuild |

The historical React source supersedes the later 4.0.2 reference in new source
candidates. Its MIT notice is byte-identical to the notice already preserved in
the editor distribution. The earlier vanilla-colorful source adds no runtime
dependency. Its declared package version is 0.0.0; it is a development commit,
not an additional engine release. Source URLs, original hashes, and selections
are pinned in [source-inputs.json](source-inputs.json).

Vanilla-colorful's initial color helpers were added on 2020-08-27. Its
acknowledgments explicitly credit react-colorful, the TypeScript rewrite by
Ryan Christian, color-fns, and the HSV repost. The
[React TypeScript conversion commit](https://github.com/omgovich/react-colorful/commit/7dd80f931f914f8bea09b38ef98298d364786cb2)
and [early MIT-licensed port](https://github.com/web-padawan/vanilla-colorful/commit/261e1c227b8dc04753e8cc04640b934d433c2d91)
provide source snapshots for comparison. They do not uniquely establish which
earlier React branch/revision was copied before those commits.

## Recomputable comparison

[notice-review.json](notice-review.json) pins eleven source/notice files by
SHA-256. The notice audit verifies their bytes and original archive URLs; the
offline rebuild also runs `verify_color_sources.cjs` using the already pinned
TypeScript 5.0.4 compiler. The compiler only parses/transpiles source text; the
reviewed application code is not executed.

The verifier compares the initializer syntax trees for thirteen declarations
in the early React and vanilla conversion modules:

- `hexToHsv`, `hexToRgb`, `hslStringToHsv`, `hslToHsv`
- `hsvToHex`, `hsvToHsl`, `hsvToHslString`, `hsvToRgb`, `hsvToRgbString`
- `rgbStringToHsv`, `format`, `rgbToHex`, `rgbToHsv`

All thirteen structures match after excluding TypeScript annotations, comments,
whitespace, quoting, and trailing-comma presentation. Identifier names, operators,
literal values, parameter patterns, and initializer structure are compared.
Imports and the surrounding module are outside this comparison, so these are
not byte-identical source files or a general proof of behavioral equivalence.
The tool rejects changed reviewed-file digests or differing initializer
structure and writes `COLOR_SOURCE_REVIEW_REPORT.json` with structural hashes.

The released 0.7.2 conversion source is also preserved. Its later changes include
alpha support, output rounding, modern CSS notation, and substring handling.
The existing source rebuild already regenerates the twelve audited
vanilla-colorful JavaScript inputs from this released TypeScript source. The
historical comparison does not replace that release comparison.

Color-fns's HEX/RGB relationship is explicitly acknowledged by both libraries.
The preserved sources retain their MIT notice. Manual inspection shows related
hex parsing and byte-to-hex formatting, with adaptations in the port: function
names/signatures, short-hex handling, and concatenation rather than array joining.
These are documented relationships, not byte equality or a claim that the
unchanged 3.2.0 functions were copied verbatim. Exact selected copying commits
remain unestablished. Complete reference sources remain available for review.

## HSV permission remains unresolved

Both libraries cite the [Axon Flux HSV repost](https://axonflux.com/handy-rgb-to-hsl-and-rgb-to-hsv-color-model-c),
which credits an earlier implementation at mjijackson.com and contains conversion
code without an explicit license. The original site link and the related author
repository/gist could not be recovered during this review. The React and port
functions use adapted scaling, indexing, and rounding; this relationship and
their own MIT notices do not independently establish the original author's grant.

No new copyright year, permission text, or license is inferred from the repost,
code similarity, an unrelated implementation, or a downstream package license.
Retain the existing notices and acknowledgments. Before publication, recover
an applicable original grant or obtain clarification from the relevant author
or maintainer. Any replacement of the distributed conversion code requires a
separate reviewed change and renewed bundle/device verification.

Two build-input notice clarifications, build-tool source-form review, final
release-checkout regeneration, and persistent public source downloads remain
separate release work. See [NOTICE_REVIEW.md](NOTICE_REVIEW.md).

## Validation

On the previously documented macOS/Python/Node/npm environment, the source
review verified eleven file digests and all thirteen initializer structures.
Manual rejection checks caught changed source bytes and changed initializer
structure even when the expected file digest was updated in an isolated review.
Presentation-only comment changes retained the structural match. An older
candidate's notice report remains recomputable by the updated auditor.

Offline preparation reproduced an identical candidate from verified cache
inputs. A fresh offline source rebuild matched all seven generated editor
outputs. The current candidate contains 501 pinned inputs and 120 package files,
approximately 60 MiB compressed, separate from the Flutter runtime package.
Python/Node/JSON syntax, documentation, and diff checks passed. Package snapshot
publish dry-run passed with zero warnings, approximately 397 KB compressed;
archives, caches, dependencies, bytecode, and local instructions were absent.
