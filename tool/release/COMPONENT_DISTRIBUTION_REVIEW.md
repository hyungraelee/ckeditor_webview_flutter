# Distributed components and notices

Component roles, declared licenses, retained notices, and source mappings for
the bundled editor and its source archive.

## Two distribution scopes

The emitted-module inventory identifies 31 packages: 26 CKEditor GPL packages
and five MIT packages. The separate source candidate retains 487 npm inputs,
including packages outside the emitted editor. Those inputs retain their own
terms; being archived alongside this GPL project does not relicense them.

[component-review.json](component-review.json) pins the reviewed input counts,
recognized declarations, exact GPL source mappings, and a supplemental notice
hash. The source auditor binds emitted roles to the JavaScript/CSS and original
build-lock hashes, confirms emitted names/versions/integrities, and records the
remaining 456 inputs as retained-archive inputs.

The report normalizes one historical MIT declaration object while retaining
the original metadata separately. Current declarations are:

| Declared family | Inputs | Review focus |
| --- | ---: | --- |
| MIT | 332 | Preserve supplied copyright, permission, and disclaimer text |
| GPL-2.0-or-later | 66 | Preserve applicable GPL notices and actual modification sources/build inputs |
| ISC | 47 | Preserve supplied copyright and permission/disclaimer text |
| BSD-2-Clause | 20 | Preserve source and binary notice/disclaimer requirements |
| BSD-3-Clause | 9 | Retain notice/disclaimer and supplied non-endorsement condition |
| Apache-2.0 | 6 | Preserve license, relevant attribution/NOTICE, and applicable change indications |
| CC0-1.0 | 4 | Retain original waiver/disclaimer and inspect supplied third-party material |
| CC-BY-4.0 | 1 | Retain supplied attribution, license/source links, and modification indications |
| BlueOak-1.0.0 | 2 | Preserve license/notice or required license reference under the original text |

Original component and embedded notices remain authoritative for their terms.
Changed declarations, input/emitted scope, GPL mappings, or supplemental
attribution fail the inventory checks.

## Source evidence for retained GPL inputs

All 66 GPL-declared npm inputs are mapped to pinned repository sources:

- 64 CKEditor 41.4.1 inputs, including unused predefined builds and the aggregate
  package, map to the existing official CKEditor release source.
- Two developer tools at 39.7.0 map to the official developer-tool release source;
  the existing auditor also verifies their 29 library JavaScript files against npm.

The component report verifies the original package name/version metadata, the
preserved upstream GPL notice, and nonempty source/resource sets under the
mapped source/lib/theme/language directories. It records file counts and a
source-list fingerprint; the source manifest separately records archive and
selected-file hashes.

Source regeneration separately verifies the selected editor inputs and resulting
bundle. Unused predefined builds, compiler bootstrap, and complete historical npm
publications are outside the reproduced scope.

## Attribution and embedded notices

Caniuse-lite 1.0.30001814 retains a CC-BY-4.0 license, compact support data, and
package metadata identifying Ben Briggs. It represents caniuse-db data from
Can I use, whose [About page](https://caniuse.com/ciu/about) credits Alexis
Deveria and community contributions and identifies its data license. This npm
input is not an emitted module, but is redistributed in the source candidate.
[SOURCE_ATTRIBUTIONS.md](SOURCE_ATTRIBUTIONS.md) accompanies the retained archive
with project/data credits, exact input/source links, original license location,
and the unchanged-tarball modification status.

The original [CC BY 4.0 terms](https://creativecommons.org/licenses/by/4.0/legalcode.en)
govern supplied attribution, license/source references, and modification
indications. The supplemental text does not replace original package notices.
Other CC0 inputs retain their original waiver texts and attribution metadata.

TypeScript 4.8.4 and 5.0.4 include `ThirdPartyNoticeText.txt`, which is preserved
in the original npm archives and in the retained upstream sources. The previous
filename inventory did not list that name. New candidates enable additional
third-party-notice prefixes so its digest is explicitly reported. Earlier
candidates retain their original scanner behavior and remain recomputable.

The six Apache inputs retain their original license texts. Inspect applicable
NOTICE/attribution and modification requirements under the
[Apache 2.0 text](https://www.apache.org/licenses/LICENSE-2.0), without assuming
that an absent standalone NOTICE establishes a defect. MDN/data and CSS-tool
CC0 files, and the two Blue Oak inputs, retain their original notices. The
[Blue Oak text](https://blueoakcouncil.org/license/1.0.0) also governs its own
notice/reference condition. Original tarball bytes remain unchanged.

## Generated report

`SOURCE_NOTICE_REPORT.json` records this inventory under `distributionComponents`.
Source preparation and rebuilding recompute it from the archived configuration.
[SOURCE_ATTRIBUTIONS.md](SOURCE_ATTRIBUTIONS.md) accompanies the package sources;
original notices remain inside the retained input archives.
