# ckeditor_webview_flutter

CKEditor 5 inside a Flutter WebView, with HTML, JavaScript, CSS, and the editor
bundle shipped as local package assets. No hosted editor page or runtime CDN is
required. The package uses `webview_flutter` and targets Android and iOS.

The bundled editor is **CKEditor 5 41.4.1**, with Korean UI. Heading, font,
color, highlight, alignment, and special-character settings use CKEditor
defaults. Toolbar overflow uses CKEditor's grouping menu.

## Usage

An Android/iOS app is included in [`example/`](example/README.md). It demonstrates
fixed and automatic height, loading/retrieving HTML, and read-only mode. Open
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

Follow `webview_flutter`'s platform requirements. Local assets do not require
adding an Internet permission or an iOS transport-security exception. Keep your
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
