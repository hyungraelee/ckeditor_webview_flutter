## 0.2.0

- Add hyperlink insertion, URL editing, and unlinking through the opt-in `link` toolbar item, with JSON `config.link` settings and HTML link preservation.
- Add opt-in bulleted and numbered lists, including nested list editing with the existing indent/outdent controls and HTML list preservation.
- Fix gesture handling for open link balloons in automatic-height mode.

The default toolbar is unchanged. Add `link`, `bulletedList`, or `numberedList`
to `toolbarItems` to show the new controls. Regenerate custom `editorAsset`
builds after updating the package.

## 0.1.0

Initial release for Android and iOS, requiring Flutter 3.27.0 and Dart 3.6.0 or later.

- Bundle CKEditor 5 41.4.1 as local WebView assets, with offline English UI and optional system-language translations from the official CDN.
- Provide an HTML controller with readiness handling, ordered commands, read-only mode, source editing, recovery snapshots, and error callbacks.
- Support fixed and automatic height, parent scrolling, and caret visibility handling.
- Allow custom toolbar items, JSON feature configuration, CSS, and loading/error UI.
- Offer optional Node.js/npm engine builds with version requests, persistent dependency locks, an asset setup command, and runtime license-key configuration.
- Include an example with sample content, both height modes, custom feature settings/styles, and inline HTML output.
- Preserve GPL-2.0-or-later and third-party notices, with separate versioned sources and offline rebuild tooling for the bundled editor.

Unsupported HTML can be normalized or removed by CKEditor. Image uploads and
General HTML Support are not included; compatibility with a web custom build
requires matching features/settings and HTML round-trip validation.
