# Third-party notices

The project is distributed under **GPL-2.0-or-later**, meaning GNU General
Public License version 2 or, at your option, any later version. The full GPL v2
text is preserved in `LICENSE`. This notice also applies to the project's
HTML, JavaScript bridge, CSS, Flutter integration, and build scripts.

## CKEditor 5 41.4.1

Copyright (c) 2003-2024, CKSource Holding sp. z o.o. All rights reserved.

The included CKEditor distribution is licensed under GPL-2.0-or-later.
Keep `assets/editor/CKEDITOR-LICENSE.txt` and
`assets/editor/ckeditor.js.LICENSE.txt` with the distribution. Original notices
in the generated JavaScript and CSS are preserved.

- License information: https://ckeditor.com/legal/ckeditor-licensing-options/
- Upstream sources: https://github.com/ckeditor/ckeditor5/tree/v41.4.1
- Locked build dependencies: `tool/ckeditor_build/package-lock.json`
- Bundle version and hashes: `assets/editor/build-info.json`

CKEditor is a trademark of CKSource Holding sp. z o.o. This package is an
independent Flutter integration and is not an official CKSource product.

## Lodash

The CKEditor license identifies Lodash as an included MIT-licensed component.
Its original copyright and license notices are preserved in
`assets/editor/LODASH-LICENSE.txt`.

Source: https://github.com/lodash/lodash

## Color UI dependencies

The bundled editor also includes these MIT-licensed components:

- `vanilla-colorful` 0.7.2: https://github.com/web-padawan/vanilla-colorful
- `color-parse` 1.4.2: https://github.com/colorjs/color-parse
- `color-convert` 2.0.1: https://github.com/Qix-/color-convert
- `color-name` 1.1.4: https://github.com/colorjs/color-name

Their original license texts and vanilla-colorful's upstream acknowledgments
are preserved in `assets/editor/THIRD_PARTY_LICENSES.txt`. Keep this file with
the bundled distribution. The acknowledgments identify additional copied-code
origins; review them when preparing the corresponding-source archive.

## Source distribution

The optional builder in `tool/ckeditor_builder/` resolves requested CKEditor versions in the
consuming application's build environment. It preserves installed upstream
license texts in the generated HTML and `dist/THIRD_PARTY_NOTICES.json` cache
artifact. The app's `ckeditor_webview_flutter.lock` identifies the resolved
engine and npm dependencies. These generated records must not be treated as
completion of corresponding-source distribution for that app release.

The editor entry point, build configuration, and exact dependency lockfile are
included in `tool/ckeditor_build/`. See [CONTRIBUTING.md](CONTRIBUTING.md) for rebuild instructions.
Those build recipes and upstream links do not by themselves replace any GPL
obligation to provide complete corresponding source when distributing a
compiled bundle. Arrange the corresponding-source distribution for the actual
release before publishing it.

The bundled-editor inventory, inspected source provenance, and outstanding
release work are documented in
[the release source audit](tool/release/README.md). The inventory is not a
source archive. Local source candidates can be prepared and rebuilt with
[the maintainer source tools](tool/release/SOURCE_ARCHIVE.md); final review and a
public release source-download location remain pending.
