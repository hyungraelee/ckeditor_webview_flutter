# ckeditor_webview_flutter

CKEditor 5 inside a Flutter WebView, with HTML, JavaScript, CSS, and the editor
bundle shipped as local package assets. The editor works offline in English;
only optional UI translations are fetched from CKEditor's official CDN.
The package uses `webview_flutter` and targets Android and iOS.

The bundled editor is **CKEditor 5 41.4.1**, with English UI as the fallback.
Heading, font, color, highlight, alignment, and special-character settings use CKEditor
defaults. Toolbar overflow uses CKEditor's grouping menu.

Applications can optionally request a CKEditor version with a Node.js/npm-based
build tool. There is no major-version whitelist: legacy source builds and modern
npm builds use separate toolchains. Default usage requires no Node installation.
Requested versions must provide the package's plugins and compatible build/API
layout; build success does not guarantee device or HTML round-trip compatibility.

## Usage

An Android/iOS app is included in [`example/`](example/README.md). It demonstrates
fixed and automatic height, sample content, and inline HTML output. Open
`example/` as a Flutter project to run it with an IDE debugger.

Add this package as a dependency. Its assets are registered by the package;
the consuming app does not need to copy the editor files or register them again.

```dart
import 'package:ckeditor_webview_flutter/ckeditor_webview_flutter.dart';

// Own this controller in your screen's State and dispose it with that screen.
final editorController = CkEditorController();
```

For a form, use a fixed height:

```dart
CkEditorWebView(
  controller: editorController,
  initialHtml: '<p>Hello</p>',
  height: 360,
  onChanged: (html) {
    // Update your screen's dirty state or HTML snapshot.
  },
  onError: (error) {
    // Connect your app's existing error reporting here.
  },
)
```

For an expanding form, give the editor unbounded vertical space inside a
Flutter scroll view:

```dart
SingleChildScrollView(
  child: CkEditorWebView(
    controller: editorController,
    initialHtml: '<p>Hello</p>',
    autoHeight: true,
    minHeight: 420,
  ),
)
```

The minimum includes the toolbar. Content can grow beyond the screen, with the
surrounding Flutter page providing scrolling. Do not put auto-height mode in an
`Expanded` or another parent that forces a fixed height. For a full-screen
editor, omit `height` and keep `autoHeight: false` inside an `Expanded` or bounded
`SafeArea`. Without a bounded parent, fixed mode defaults to height 360.

```dart
await editorController.setHtml('<p>Updated</p>');
final html = await editorController.getHtml();
await editorController.setReadOnly(true);
await editorController.focus();
await editorController.clear();

// In your screen's dispose():
editorController.dispose();
```

Commands wait for initialization and throw `CkEditorError` on failure. The
controller states are `notInitialized`, `loading`, `ready`, `error`, and
`disposed`. One controller belongs to one editor at a time.

`initialHtml` seeds the first mount only. Use `setHtml()` for later updates.
Reusing the same controller restores its best-effort `cachedHtml` snapshot;
call `getHtml()` explicitly before saving or leaving the screen. `readOnly` and
`changeDebounce` are widget options; the default change debounce is 300 ms.

Events: `onReady`, `onChanged`, `onFocus`, `onBlur`, and `onError`. Override
`loadingBuilder` and `errorBuilder` to match your app's UI. The error builder
receives a retry callback, or null for a disposed controller. Navigation outside
the local editor document is blocked; `onNavigationBlocked` lets your app
delegate a URL to an external browser if desired.

## Toolbar

Set `toolbarItems` to choose buttons, order them, and separate groups:

```dart
CkEditorWebView(
  controller: editorController,
  toolbarItems: const [
    'heading', '|', 'bold', 'italic', '|', 'sourceEditing',
  ],
)
```

Null (the default) keeps the existing package toolbar; `const []` shows no
buttons. Supported names are `heading`, `sourceEditing`, `bold`, `italic`,
`underline`, `strikethrough`, `fontFamily`, `fontSize`, `fontColor`,
`fontBackgroundColor`, `highlight`, `subscript`, `superscript`, `horizontalLine`,
`showBlocks`, `specialCharacters`, `alignment`, `outdent`, `indent`, `undo`,
`redo`, and the `|` group separator. The `toolbarItems` API documentation
describes each item. Names are case-sensitive; unsupported names report
`invalid_toolbar_items` through `onError`.

Toolbar buttons still group into the overflow menu on narrow screens. Images,
tables, custom buttons, and the `-` line break are not available in this API.
Hiding buttons does not remove plugins or strip their supported HTML. The
option is applied when the editor is created, including recreation/retry.
Changes after initialization take effect on the next editor creation. Treat
supplied lists as immutable.

## UI language

On initialization, the editor reads the device's system locale from Flutter's
`PlatformDispatcher.locale`. English starts directly from local assets. For
other languages, it downloads the matching legacy translation script from
`https://cdn.ckeditor.com/ckeditor5/41.4.1/super-build/translations/<language>.js`
and registers it before creating the editor. The super-build translation file
covers the locally enabled features; no remote editor bundle is loaded.

The network request has a three-second timeout. Offline connections, unavailable
translations, HTTP errors, and script registration failures fall back to English.
Translations are not persisted; each new editor session checks again. The system
language is read when initializing or retrying; changing it does not recreate an
open document. UI language does not change the document's content language or
convert the stored HTML.

See CKEditor's [UI language guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/ui-language.html).
This package uses the legacy 41.4.1 translation format rather than the current
CDN format shown for newer editor versions.

Opt-in generated assets use their actual resolved version. Modern installations
use the official `translations/<language>.umd.js` endpoint and pass its object to
the editor configuration; legacy installations use the matching super-build
translation endpoint. The same timeout and English fallback apply.

## Optional engine version builds

Keep the default widget for the bundled editor, or opt into version selection
using a Flutter asset transformer and `editorAsset`. Only opted-in applications
need Node.js 20+ and npm on development machines and CI. These tools run while
building assets, never on the mobile device or during `flutter pub get`.

For setup, see [the optional builder guide](tool/ckeditor_builder/README.md).
Run `dart run ckeditor_webview_flutter init --version "^42.0.0"` from the
consuming app root to create the input asset and register the version and
transformer in `pubspec.yaml`. The command preserves unrelated settings and
comments. Set `editorAsset: 'assets/ckeditor.html'` on the widget once; the
command prints this option and does not rewrite application Dart files.
Flutter run/build then packages a local, self-contained editor document.
Users do not manually author HTML, JavaScript, or adapters.

Commit the generated `ckeditor_webview_flutter.lock` in the consuming app.
It freezes the resolved engine and npm dependencies, even for caret/wildcard
requests. Updates require an explicit command; ordinary runs reuse the selected
version and cache. Build-time version requests do not change `getHtml()`'s HTML
storage contract or add unsupported features to the existing toolbar.

Accept exact, caret/tilde, and numeric wildcard requests such as `41.4.1`,
`^43.0.0`, `~44.0.0`, or `48.x`. Tags, URLs, prereleases, and compound ranges are
not accepted. Versions before 42 use the legacy webpack recipe; newer versions
use esbuild. Generated engines from version 44 receive the widget's `licenseKey`
at initialization, as described in the
[official self-hosted installation guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/installation/self-hosted/quick-start.html).

Both widget options are optional: `editorAsset` defaults to the bundled 41.4.1
editor, and `licenseKey` defaults to `'GPL'`. The GPL default requires
GPL-compliant use. The bundled engine and generated releases before 44 ignore
the key. Override it to pass a self-hosted CKEditor commercial key when
appropriate; this does not change this package's own GPL license or grant
permission to use the package under different terms.

```dart
CkEditorWebView(
  controller: editorController,
  editorAsset: 'assets/ckeditor.html',
  licenseKey: const String.fromEnvironment(
    'CKEDITOR_LICENSE_KEY', defaultValue: 'GPL',
  ),
)
```

The consuming app can use `--dart-define=CKEDITOR_LICENSE_KEY=...` or supply a
value through its own configuration. Key values are passed through the bridge
and are not written into generated HTML, npm locks, or cache metadata. App
configuration does not provide secret storage for a value shipped on devices.
Changing `licenseKey` recreates the WebView. Empty/whitespace keys report
`invalid_license_key` when the selected engine requires one; other activation
failures are reported by CKEditor through `onError`.

After updating the builder package, run `flutter clean` and rebuild generated
assets. Asset protocol 2 prevents older assets with hard-coded GPL activation
from silently ignoring a widget override.

## HTML and editing

CKEditor runs in the WebView's DOM, separately from Flutter's widget tree.
`setData()` converts HTML into CKEditor's model; `getData()` serializes that
model back into HTML. The package saves that result directly. JSON encoding
protects Flutter/JavaScript string transfer, and JavaScriptChannel sends events
back to Flutter.

Included features: paragraph, heading, source editing, bold, italic, underline,
strikethrough, font family/size/color/background, highlight, subscript,
superscript, horizontal line, show blocks, special characters, alignment, and
block indentation. Images, uploads, and General HTML Support are not enabled.
Unsupported tags or attributes can be normalized or removed by the model.

`onChanged` delivers the complete HTML after debounce. This version still
serializes debounced changes when the callback is omitted. A dirty-only bridge
would be a separate extension for large documents. Always read `getHtml()` at
save time so the latest changes and source edits are included.

Using the same CKEditor version, plugins, and configuration helps preserve
formatting, but compatibility with a particular web custom build must still be
verified by repeated Web → App → Web round trips. String identity is not
required; formatting after CKEditor normalization is what matters.

## Platform and release validation

Follow `webview_flutter`'s platform requirements. On Android, add the following
permission to the app's `android/app/src/main/AndroidManifest.xml` to enable
online UI translations in release builds:

```xml
<uses-permission android:name="android.permission.INTERNET" />
```

The local English editor still works without network access. The translation
endpoint uses HTTPS and needs no iOS transport-security exception. Keep your
screen in a `SafeArea` and allow keyboard resizing. On Android, check the
activity's `windowSoftInputMode="adjustResize"` when input is covered.

This package was extracted from an application where auto-height and caret
visibility were manually checked. The standalone package's asset loading,
keyboard, selection, source editing, dropdown gestures, navigation, and
push/pop behavior still need Android/iOS device checks. A complete comparison
with the web service's custom build has not been performed.

## Rebuilding the bundled editor

End users do not need Node.js. Maintainers can rebuild with:

```sh
cd tool/ckeditor_build
npm ci
npm run build
```

All CKEditor runtime packages are pinned to 41.4.1. The build writes the bundle,
CSS, vendor license, and version/hash metadata to `assets/editor/`. The bridge's
plugin and toolbar lists live in `assets/editor/editor.js`. When changing
plugins, keep those lists aligned with `tool/ckeditor_build/editor-entry.js`.
The build intentionally keeps CKEditor's feature configuration at defaults.

## License

**GPL-2.0-or-later**: GNU General Public License version 2 or, at your option,
any later version. See `LICENSE` and `THIRD_PARTY_NOTICES.md`. The bundled
CKEditor is GPL-2.0-or-later; its original notices are preserved.

Using the package in a closed-source app requires a separate assessment of GPL
obligations or appropriate CKEditor commercial licensing. Publishing this
package as open source does not grant a commercial CKEditor license to its users.
Before publishing a compiled release, provide the complete corresponding source
required by the GPL in addition to the build recipes and upstream references.
