# Targeted acorn notice and HSV permission review

This follow-up addresses the two previously recorded permission/notice questions
for the bundled 41.4.1 source candidate. Runtime Dart, editor assets, dependency
versions and build recipes are unchanged. No upstream author was contacted.

## Acorn supplemental notice

The locked `acorn-import-assertions` 1.9.0 README explicitly declares MIT. Its
README and `src/index.js` match the preserved npm gitHead
`809f1c58c699fd084b6db8096963d916fc69d4c7` byte for byte. The publication identifies
Sven Sauleau as the author. The original tarball lacks a complete notice file.

The earlier review retained a later notice as a reference because the renamed
implementation had changed. Newly recovered primary evidence supports using
that original text as a supplemental notice for the retained assertions input:

- On 2023-02-22, before the 1.9.0 release on 2023-05-12, the repository owner
  [authorized an MIT notice with his name](https://github.com/xtuc/acorn-import-attributes/issues/16#issuecomment-1439894133).
- The same owner merged [the notice-addition PR](https://github.com/xtuc/acorn-import-attributes/pull/26)
  on 2023-08-27. The original LICENSE names Sven Sauleau and is preserved at
  commit `2c7059709cc529d81194c2d7057c181f4000e375`.

[permission-evidence.json](permission-evidence.json) retains the brief original
owner statement, its URL/date/body digest, the recorded PR merge and source/notice
digests. [notices/acorn-import-assertions-LICENSE.txt](notices/acorn-import-assertions-LICENSE.txt)
copies the original MIT text without inventing a copyright year or holder.
It accompanies the retained build input; it is not an editor runtime notice or
a replacement tarball. This plugin is outside the emitted-editor inventory.

The project assesses these facts as sufficient evidence for the supplemental
notice's applicability to its retained 1.9.0 input. The audit status becomes
`upstream-notice`; the auditor verifies the notice against its pinned upstream
bytes, the supplemental copy, the reviewed evidence digest, and two locked-input
source comparisons. It does not decide legal applicability automatically or
claim that the later implementation is identical to 1.9.0. Older archived reviews
without the optional evidence fields remain recomputable.

No build dependency replacement is needed for this notice clarification. All
487 npm inputs and the original editor build lock remain unchanged. This closes
the previously recorded acorn notice gap in this project's review, not every
possible embedded-component or contributor-rights question.

## HSV original grant remains unrecovered

The [mjackson color-conversion Gist](https://gist.github.com/mjackson/5311256)
is now accessible. Its fixed revision
`132d6d1f39bf422e03c8ab86b5329d6f4dfbc383`, dated 2013-04-04, contains the four
RGB/HSL/HSV conversion functions without explicit license text. The 30 existing
comments retrieved during this review include license requests but no response
from the Gist owner. This is a bounded observation of the retrieved material,
not proof that a grant never existed elsewhere. The old blog page remains
distinct from this later Gist; exact historical copying revisions are unproved.

The evidence file records the Gist URL, revision and source digest. The Gist code
and third-party comment implementations are not copied into the distribution.
Neither another port's license nor a commenter's interpretation supplies a grant
from the original author. Existing vanilla-colorful notices and acknowledgments
remain intact; source similarity alone does not resolve permission.

The remaining targeted action is either an applicable original clarification or
a separately reviewed conversion replacement. A replacement must cover affected
conversion helpers and retained sources, preserve other applicable notices,
document modifications, regenerate bundle provenance and validate color-picker
behavior. Changing a top-level declaration or removing an acknowledgment would
not establish a replacement. It would change generated editor output and needs
renewed regression and device validation.

## Publication status

The acorn notice review now has primary maintainer evidence and a preserved
supplemental notice. Original HSV permission, final retained-component review,
approved clean-release regeneration and persistent anonymous source downloads
remain open. Existing source-generation limits are evidence boundaries, not
automatically additional license conditions. Nothing in this phase uploads a
source artifact or publishes a package.
