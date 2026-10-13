# Integration licensing and source delivery review

Reviewed 2026-10-13. This maintainer record compares selected public repository
files and official guidance. It does not approve other projects' distributions,
license this package under their terms, or certify the complete release.
Runtime code, editor assets, upstream notices, and the project's GPL license
remain unchanged. No code is copied from the compared integrations.

## Pinned integration examples

[integration-license-evidence.json](integration-license-evidence.json) records
five repository commits, inspected file paths, SHA-256 hashes, and permalinks.
These are comparison evidence, not dependencies or source inputs to our bundle.

| Example | Inspected scope | Applicable observation |
| --- | --- | --- |
| [Official React v12.0.0](https://github.com/ckeditor/ckeditor5-react/tree/21d889d95f503ded5c0aa78d42453e15b2af7a5f) | LICENSE.md, README, manifest | The integration declares GPL-2.0-or-later/commercial terms, publishes its license, and treats the engine as a separate peer dependency. React integration and engine versions differ. This current release does not establish terms for an older wrapper. |
| [Django v0.2.20](https://github.com/hvlads/django-ckeditor-5/tree/5ed45a80b81d322f0551646703729c59b23d156f) | BSD notice, manifests, static-file inclusion, engine dependencies | The wrapper declares BSD-3-Clause while depending on CKEditor 5 and including static files. Its wrapper declaration does not replace engine terms or establish rights for our combined distribution. Published wheel completeness was not audited. |
| [Drupal 11.3.0](https://github.com/drupal/drupal/tree/ac5da07ad88571dbb31dfb52f055bb0d4063f598) | GPL text, core manifest, plugin source/build configuration, vendor-update script | The core manifest declares GPL-2.0-or-later; engine versions and integration build steps are recorded separately. Preserve both licensing information and rebuild inputs. A full Drupal source-delivery audit was not performed. |
| [Flutter CKEditor 5 WIP](https://github.com/dfdgsdfg/flutter_ckeditor5/tree/b1fb87e4964efff223fcc4efff01f53a0a4b232b) | LICENSE, asset declarations, HTML and loader | The root license is a template placeholder. HTML retains CKSource attribution and the loader references local editor assets. This is not a verified licensing precedent. |
| [Flutter CKEditor snapshot](https://github.com/maxcorrads/flutter_ckeditor/tree/1968ddba2692466f330f7d1d44979367f6a673d8) | LICENSE, manifest, WebView/browser loading | The root license is a template placeholder and code loads CKEditor 5 23.1.0 from CDN. It is not a verified license grant or a local-bundle/source-delivery precedent. |

Only observed files support these conclusions; repository labels or download
counts do not establish compliance. No recommendation to adopt either WIP
project is made. All sampled engine usage is CKEditor 5. CKEditor 4's historical
LGPL/MPL choices must not be imported into CKEditor 5 or this package.

## Official requirements and package boundaries

The bundled 41.4.1 engine's original notice is the version-specific basis for
its GPL-2.0-or-later distribution. Current CKEditor guidance is used for newer
optional engines and commercial/channel questions; it does not overwrite the
bundled notice or license past releases retroactively.

CKEditor's [license guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-and-legal.html)
and [activation guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/license-key-and-activation.html)
distinguish GPL, commercial distribution channels, and restricted releases.
An activation value is not evidence of contractual scope. Review the resolved
version, plugins, self-hosted/mobile distribution, and any production or
redistribution entitlement. LTS-only releases cannot be assumed GPL-eligible.
The [subscription explanation](https://support.ckeditor.com/hc/en-us/articles/360000540469-What-am-I-entitled-to-while-on-active-subscription)
separately identifies use and distribution rights; no general mobile/OEM
entitlement is inferred for every commercial plan.

This independently authored Flutter integration is offered only under
GPL-2.0-or-later, without a commercial exception. A CKSource agreement does not
relicense its integration code. GPL-compliant distribution can be commercial;
free-of-charge distribution does not remove GPL conditions. Closed-source
consumers must address each applicable component rather than treating a paid
editor key as an exception for this package.

The editor itself is local/self-hosted. Downloading optional UI translations
does not make it a Cloud-distributed editor. Trial/development activation is not
proof of production entitlement. The current configuration passes keys at
runtime and does not store them in builder locks; values delivered to an app are
not secret storage. Premium features are not enabled by this package's builder.
Check feature terms when changing engine versions.

Retain original copyright, license, and trademark notices and do not present the
package as an official CKSource product. No sample CSS hides branding. Review
branding changes against the selected release and the
[upstream whitelabelling guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/licensing/managing-ckeditor-logo.html).
This review does not add a new license condition or grant branding permission.

## Source delivery and tool review scope

[GPL v2 section 3](https://www.gnu.org/licenses/old-licenses/gpl-2.0.html#section3)
addresses source for the distributed work, including modification sources,
interface definitions, and build/install scripts. GNU's
[source-location explanation](https://www.gnu.org/licenses/old-licenses/gpl-2.0-faq.html#SourceAndBinaryOnDifferentSites)
supports a cross-reference with an arrangement that keeps matching source
available alongside distributed binaries. A random upstream link or only the
Flutter repository snapshot does not implement our planned release source offer.

Review obligations component by component. GNU's
[tool/output distinction](https://www.gnu.org/licenses/old-licenses/gpl-2.0-faq.html#CanIUseGPLToolsForNF)
and [compiler guidance](https://www.gnu.org/licenses/old-licenses/gpl-2.0-faq.html#NonFreeTools)
do not make every tool used to produce an output part of that output's license.
Copied runtime/helper output and tools actually redistributed still require
review under their own terms. Therefore exact compiler bootstrap reproduction
is recorded as a verification limit, not asserted as an automatic GPL violation.
Preserved Apache/MIT/BSD tool sources remain useful evidence; this review neither
removes them nor assumes permissive declarations cover every embedded component.

The candidate redistributes two GPL CKEditor developer-tool npm inputs at 39.7.0.
The official release commit `15c6c4290c794717f03021bf4cf3ee8a511ca942` is now pinned
with original notices and package/build inputs. All eight translation-library
and 21 utility-library JavaScript files are byte-identical to its modification
sources. The existing notice auditor repeats these 29 comparisons. These are
original JavaScript sources, not another TypeScript/bootstrap generation claim.
No engine or dependency version is changed. Other CKEditor package sources are
preserved at the existing 41.4.1 release commit; this finding is scoped and does
not certify every archive member.

## Release disposition

The consumer README and builder guide now distinguish package GPL terms from
engine activation, commercial channel/deployment coverage, and app source duties.
Third-party notices link this review. Detailed comparisons remain maintainer
material, rather than consumer setup instructions.

Before publication, the remaining work includes:

- Review original HSV permission and acorn notice applicability using their
  recorded evidence; other integrations do not resolve these questions.
- Review source/notice applicability for the actual retained components, keeping
  historical reproduction limits distinct from an identified missing grant.
- Regenerate the approved clean release candidate and verify source/build outputs.
- Publish version-specific source archives and checksums with anonymous access,
  link them beside the distributed bundle information, and retain access for
  published versions. Do not delete a matching source release while its package
  remains downloadable.
- Ensure any upstream modifications retain applicable change notices/dates;
  preserve original notices separately from project licensing.
- Keep app-specific and generated-engine source offers separate from this
  bundled-41.4.1 release. A lock/cache is not the app's completed source offer.

The [pub.dev publishing requirements](https://dart.dev/tools/pub/publishing)
require rights to redistribute uploaded contents. A successful dry-run verifies
package structure, not legal completeness. No license is changed and no source
archive or package is uploaded by this review.
