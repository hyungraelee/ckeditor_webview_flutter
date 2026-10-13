# Distributed component scope and notice conditions

This maintainer review covers the actual bundled-editor inventory and the npm
inputs retained in the 41.4.1 source candidate. It records component roles,
notice preservation, and source-presence evidence. It is not complete legal
approval of every embedded component, and does not resolve original HSV
permission or acorn notice applicability.

## Two distribution scopes

The emitted-module inventory identifies 30 packages: 25 CKEditor GPL packages
and five MIT packages. The separate source candidate retains 487 npm inputs,
including packages outside the emitted editor. Those inputs retain their own
terms; being archived alongside this GPL project does not relicense them.

[component-review.json](component-review.json) pins the reviewed input counts,
recognized declarations, exact GPL source mappings, and a supplemental notice
hash. The source auditor binds emitted roles to the JavaScript/CSS and original
build-lock hashes, confirms emitted names/versions/integrities, and records the
remaining 457 inputs as retained-archive inputs. That role describes the
recorded module inventory, not a legal finding about every transformed output.

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

These are package declarations, not a compatibility certificate or a statement
that every embedded work shares the package's declared terms. New declarations,
changed input/emitted scope, missing GPL mappings, and changed supplemental
attribution fail the reproducible review checks.

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

This proves the recorded sources are present and mapped to the locked inputs.
It does not reproduce every unused predefined build or certify completeness of
all source/build obligations. Existing source regeneration verifies the audited
editor inputs and resulting bundle; source presence is not substituted for that
comparison. Exact compiler bootstrap and full historical npm publication
reproduction remain verification limits with the scope documented elsewhere.

## Attribution and embedded notices

Caniuse-lite 1.0.30001814 retains a CC-BY-4.0 license, compact support data, and
package metadata identifying Ben Briggs. It represents caniuse-db data from
Can I use, whose [About page](https://caniuse.com/ciu/about) credits Alexis
Deveria and community contributions and identifies its data license. This npm
input is not an emitted module, but is redistributed in the source candidate.
[SOURCE_ATTRIBUTIONS.md](SOURCE_ATTRIBUTIONS.md) accompanies the retained archive
with project/data credits, exact input/source links, original license location,
and the unchanged-tarball modification status. No copyright owner/year is
invented and no dataset is relicensed or modified.

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

## Unresolved permissions and release disposition

The acorn input still declares MIT; its later renamed-project notice is a
preserved reference with unresolved applicability. The original HSV grant
remains unrecovered. This phase adds no new permission evidence for either,
does not infer a grant from a downstream declaration, and does not contact an
upstream author. Their existing notice/source records remain unchanged.

The classification narrows the previous broad build-input review into explicit
roles, declaration families, and GPL source evidence. It does not mark the
candidate approved for publication. Before release, review the actual retained
component notices and embedded terms, resolve or explicitly assess the recorded
permission questions, regenerate the approved clean checkout, and provide
persistent anonymous source access alongside the package's binary distribution.
No source archive or package is uploaded by these tools.

The report remains in `SOURCE_NOTICE_REPORT.json` under `distributionComponents`.
Source preparation and fresh rebuilding recompute it from the archived review
configuration. The supplemental attribution file is included with package
sources inside the candidate; original input archives remain the notice source
of record. Runtime editor/Dart code and the project GPL license are unchanged.
