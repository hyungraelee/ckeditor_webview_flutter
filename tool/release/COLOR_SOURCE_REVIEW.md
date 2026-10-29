# Color UI source comparison

Pinned reference sources and reproducible initializer comparisons for
vanilla-colorful 0.7.2.

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
