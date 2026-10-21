# Source notice inventory

The source archive includes `SOURCE_NOTICE_REPORT.json`, generated from the
pinned npm inputs, upstream archives, and package notices.

## Verify an archive

```sh
python3 tool/release/prepare_sources.py --offline \
  --output .dart_tool/release/source-candidate-next.tar.gz
python3 tool/release/audit_source_notices.py \
  .dart_tool/release/source-candidate-next.tar.gz
```

The auditor recomputes the report, verifies notice and source digests, and rejects
changed evidence or new inputs without notice coverage. Preparation without
`--offline` downloads the pinned archives; offline mode requires verified cache
entries. The inventory contains 487 distinct npm tarballs: 476 with notice files,
six with embedded notices, and five with preserved upstream notices.

## Embedded and upstream notices

[notice-review.json](notice-review.json) pins the following notice locations.
Original npm tarballs and embedded notice text are preserved unchanged.

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
| `acorn-import-assertions` 1.9.0 | MIT README declaration; pre-release owner authorization and owner-merged original notice, preserved as a supplemental copy | Upstream notice with maintainer clarification |
| `boolbase` 1.0.0 | Original ISC text at the upstream license-addition commit; its `index.js` matches the locked npm input | Upstream notice preserved |

Commit URLs and archive hashes are in [source-inputs.json](source-inputs.json).
The audit also checks six blurhash TypeScript sources against npm source-map
content, Once's same-version sources, and boolbase's locked implementation.

## Acorn supplemental notice

The locked `acorn-import-assertions` 1.9.0 README declares MIT. Its supplemental
notice is preserved in [notices/acorn-import-assertions-LICENSE.txt](notices/acorn-import-assertions-LICENSE.txt).
[acorn-notice-evidence.json](acorn-notice-evidence.json) records the maintainer's
[authorization](https://github.com/xtuc/acorn-import-attributes/issues/16#issuecomment-1439894133),
the [notice-addition PR](https://github.com/xtuc/acorn-import-attributes/pull/26),
and the original notice and source digests. The auditor verifies the supplemental
copy against the pinned upstream text and checks the evidence file's digest.

## Editor notices and source comparisons

Original vanilla-colorful, react-colorful, and color-fns notices and upstream
acknowledgments are preserved in the editor's `THIRD_PARTY_LICENSES.txt`.
The audit verifies their bytes and the pinned reference source files.
[COLOR_SOURCE_REVIEW.md](COLOR_SOURCE_REVIEW.md) describes the initializer
comparison; [LODASH_GENERATION.md](LODASH_GENERATION.md) describes the scoped
Lodash regeneration recipe.

[BUILD_TOOL_SOURCE_REVIEW.md](BUILD_TOOL_SOURCE_REVIEW.md) documents compiler
sources and CLI generation. [COMPONENT_DISTRIBUTION_REVIEW.md](COMPONENT_DISTRIBUTION_REVIEW.md)
records emitted components, retained build inputs, GPL source mappings, and
supplemental source attribution.

## Release validation

Generate an archive from the clean release commit, verify its manifest and
notices, and run the offline rebuild. Publish the archive and checksum at the
versioned source URLs and verify anonymous access before uploading to pub.dev.
See [SOURCE_ARCHIVE.md](SOURCE_ARCHIVE.md) and [AUTOMATED_RELEASE.md](AUTOMATED_RELEASE.md).
