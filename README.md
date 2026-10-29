# ckeditor_webview_flutter

CKEditor 5 inside a Flutter WebView, with HTML, JavaScript, CSS, and the editor
bundle shipped as local package assets. The editor works offline in English;
only optional UI translations are fetched from CKEditor's official CDN.
The package uses `webview_flutter` and targets Android and iOS.

The bundled editor is **CKEditor 5 41.4.1**, with English UI as the fallback.
Heading, font, color, highlight, alignment, and special-character settings use
CKEditor defaults unless overridden with `config`. Toolbar overflow uses
CKEditor's grouping menu.

Applications can optionally request a CKEditor version with a Node.js/npm-based
build tool. Default usage requires no Node installation.
Requested versions must provide the package's plugins and compatible build/API
layout; build success does not guarantee device or HTML round-trip compatibility.

## Installation

Requires Flutter **3.27.0+** and Dart **3.6.0+** on Android or iOS.

```yaml
dependencies:
  ckeditor_webview_flutter: ^0.1.0
```

Run `flutter pub get`. Package assets are registered automatically; there is
no need to copy editor files or register them in the consuming app.
This package uses **GPL-2.0-or-later**; see [License](#license) before integrating it.

## Usage

An Android/iOS app is included in [`example/`](example/README.md). It demonstrates
fixed and automatic height, sample content, and inline HTML output. Open
`example/` as a Flutter project to run it with an IDE debugger.

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

Package error messages are English diagnostics. Use `CkEditorError.code` to
select localized messages in your `errorBuilder` or error reporting.

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
`redo`, `link`, `bulletedList`, `numberedList`, and the `|` group separator. The `toolbarItems` API documentation
describes each item. Names are case-sensitive; unsupported names report
`invalid_toolbar_items` through `onError`.

Toolbar buttons still group into the overflow menu on narrow screens. Images,
tables, custom buttons, and the `-` line break are not available in this API.
Hiding buttons does not remove plugins or strip their supported HTML. The
option is applied when the editor is created, including recreation/retry.
Changes after initialization take effect on the next editor creation. Treat
supplied lists as immutable.

### Links

Add `link` to `toolbarItems` to insert, edit, and remove hyperlinks using
CKEditor's link UI. It is opt-in; the default toolbar is unchanged.

```dart
CkEditorWebView(
  controller: editorController,
  toolbarItems: const ['bold', 'italic', '|', 'link', '|', 'sourceEditing'],
  config: const {'link': {'defaultProtocol': 'https://'}},
)
```

Select text and use the link button, or place the caret in an existing link to
edit its URL or remove it. Links are stored as HTML `<a href="…">` elements and
are preserved even when the link button is hidden. Link settings follow the
selected engine's [link configuration](https://ckeditor.com/docs/ckeditor5/latest/features/link.html).
JSON settings such as `defaultProtocol` and declarative decorators are supported;
function callbacks are not. Automatic URL conversion is disabled to preserve
existing text-entry behavior. Navigation remains subject to the package's WebView policy.

For generated `editorAsset` builds, update this package, run `flutter clean`,
and rebuild before using `link` or `config.link`.

### Lists

Add `bulletedList` and `numberedList` to `toolbarItems` to create, switch, or
remove lists. The default toolbar is unchanged.

```dart
CkEditorWebView(
  controller: editorController,
  toolbarItems: const [
    'bulletedList', 'numberedList', '|', 'outdent', 'indent', '|', 'sourceEditing',
  ],
)
```

Select paragraphs to apply a list, or use the active list button again to return
to paragraphs. The existing indent/outdent buttons nest and unnest list items.
Enter continues a list; Enter on an empty item leaves it or reduces its nesting.
Typed `- ` and `1. ` remain plain text; automatic list formatting is not enabled.

Supported `<ul>`, `<ol>`, and `<li>` content is preserved even when the list buttons
are hidden. Storage uses CKEditor's HTML output, which may normalize paragraph
wrappers and list structure. Custom list styles, start numbers, and to-do lists
are not included. See CKEditor's [list documentation](https://ckeditor.com/docs/ckeditor5/latest/features/lists/lists.html).

For generated `editorAsset` builds, update this package, run `flutter clean`,
and rebuild before using the list buttons.

## Feature configuration

Pass CKEditor feature settings through the optional `config` map. CKEditor
option names and nested structures are preserved; no engine rebuild is needed
for the bundled editor.

```dart
CkEditorWebView(
  controller: editorController,
  config: const {
    'placeholder': 'Write here...',
    'fontFamily': {
      'options': ['default', 'Arial, Helvetica, sans-serif', 'Georgia, serif'],
      'supportAllValues': true,
    },
    'fontSize': {
      'options': [12, 16, 20, 24, 'default'],
      'supportAllValues': true,
    },
    'fontColor': {
      'colors': [
        {'color': '#000000', 'label': 'Black'},
        {'color': '#D32F2F', 'label': 'Red'},
        {'color': '#1976D2', 'label': 'Blue'},
      ],
      'columns': 3,
    },
  },
)
```

Supported top-level keys:

| Key | Configures |
| --- | --- |
| `heading` | Available headings, HTML views, menu titles, and classes |
| `fontFamily` | Font choices and `supportAllValues` |
| `fontSize` | Size choices and `supportAllValues` |
| `fontColor`, `fontBackgroundColor` | Color palettes, columns, and picker settings |
| `highlight` | Marker/pen choices |
| `alignment` | Available text alignments |
| `indentBlock` | Indentation offset/unit or configured classes |
| `specialCharacters` | Order of included character groups |
| `placeholder` | Empty-editor placeholder text |
| `link` | Default URL protocol and declarative link decorators |

Null or an empty map retains defaults. Omitted settings remain at CKEditor
defaults. Feature sections are passed directly to CKEditor, which handles their
nested defaults and schema; check the documentation for the selected engine
version. See the official [configuration guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/configuration.html)
and [font options](https://ckeditor.com/docs/ckeditor5/latest/features/font.html).

Only JSON values are supported: null, booleans, strings, finite numbers, lists,
and maps with string keys. Functions, plugin classes, custom objects, cyclic
containers, dotted keys, and JavaScript prototype keys (`__proto__`,
`prototype`, `constructor`) are rejected. Unsupported top-level keys or invalid
JSON values report `invalid_editor_config` through `onError`. Other malformed
feature options may fail during CKEditor creation or be ignored by that engine.

Use `toolbarItems`, `initialHtml`, and `licenseKey` for those settings. Plugins,
language, translations, layout, and lifecycle remain managed by the package.
This map does not install plugins, bundle fonts, or inject visual CSS. A font
choice works only if that font is available on the device. Class-based heading,
highlight, or indentation choices may need matching content CSS in the editor
and on the publishing website. Use `customCss` for editor-side visual styles.

Settings apply on creation/retry. Updating `config` does not recreate an active
editor or change its current document. Treat the map and all nested containers
as immutable, as with `toolbarItems`.

For generated `editorAsset` builds, update to this package version, run
`flutter clean`, and rebuild before using custom configuration. Older generated
assets report `invalid_editor_bundle` when a non-empty config is requested;
they remain usable without custom configuration.

Configuration can affect HTML preservation: limiting headings, font choices,
or sizes may remove imported formatting. The example uses `supportAllValues`
for font family and numeric sizes to accept values beyond menu choices;
`fontSize.supportAllValues` requires numeric size options (the `default` reset
option can also be included). This does not enable arbitrary HTML support or
guarantee compatibility with a web custom build. Validate repeated HTML round
trips using matching features and settings.

## Visual styles

Pass optional CSS text through `customCss` to style the toolbar and editing
content independently of feature `config`:

```dart
CkEditorWebView(
  controller: editorController,
  customCss: '''
:root {
  --ck-color-toolbar-background: #eef2ff;
  --ck-color-base-border: #a5b4fc;
  --ck-color-focus-border: #4f46e5;
  --ck-border-radius: 8px;
}
#editor-container .ck-content {
  background: #fffdf7;
  font-family: Georgia, serif;
  font-size: 16px;
  line-height: 1.8;
  padding: 16px 20px;
}
''',
)
```

Null or an empty string preserves existing styles. Custom CSS applies after
the bundled styles. Supply CSS rules without HTML `style` tags. Normal cascade,
specificity, and inline-style precedence apply; invalid declarations are
handled by the WebView's CSS parser.

| Target | Examples |
| --- | --- |
| Toolbar and controls | `:root` variables such as `--ck-color-toolbar-background`, `--ck-color-base-border`, `--ck-color-focus-border`, `--ck-border-radius`, `--ck-font-size-base` |
| Editing content | `#editor-container .ck-content` for font, line height, background, or padding |
| Source-editing textarea | `#editor-container .ck-source-editing-area textarea` |

Variables and selectors depend on the selected CKEditor version. Prefer its
documented theme variables for UI changes. See the official
[editor and content styles guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/css.html).
Styles affect the WebView document; Flutter loading/error overlays use their
existing builders. Avoid overriding the package's height, flex, and overflow
rules, which support fixed/automatic height, scrolling, and caret visibility.

`getHtml()` still returns CKEditor's data HTML. It does not include this
stylesheet or turn CSS into inline document formatting. For example, changing
the default content font in CSS changes its display without adding font spans
to every paragraph. Apply matching content styles to the publishing page to
keep that appearance. Explicit font/color formatting in the document continues
to follow normal CSS precedence.

Use the supplied string directly or load a registered app CSS asset with
`rootBundle.loadString()` before creating the widget. The package does not load
a CSS file path automatically. Relative URLs inside CSS resolve from the editor
HTML asset, which differs between bundled and generated editors; fonts and
resources are not copied or rebased automatically. Remote URLs and imports need
network access. The example CSS needs no external resources.

Styles apply on creation/retry, like `config`. Updating `customCss` alone does
not recreate an active document. For generated `editorAsset` builds, update
the package, run `flutter clean`, and rebuild before using custom styles. Older
assets report `invalid_editor_bundle` when non-empty CSS is requested; they
remain usable without CSS customization.

## UI language

On initialization, the editor uses the device's system language. English starts
directly from local assets. Other UI translations are downloaded from CKEditor's
official CDN for the selected engine version. The editor bundle stays local.

The network request has a three-second timeout. Offline connections, unavailable
translations, HTTP errors, and script registration failures fall back to English.
Translations are not persisted; each new editor session checks again. The system
language is read when initializing or retrying; changing it does not recreate an
open document. UI language does not change the document's content language or
convert the stored HTML.

See CKEditor's [UI language guide](https://ckeditor.com/docs/ckeditor5/latest/getting-started/setup/ui-language.html).

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
not accepted. Generated engines from version 44 receive the widget's `licenseKey`
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
value through its own configuration. App configuration does not provide
secret storage for a value shipped on devices.
Changing `licenseKey` recreates the WebView. Empty/whitespace keys report
`invalid_license_key` when the selected engine requires one; other activation
failures are reported by CKEditor through `onError`.

After updating the builder package, run `flutter clean` and rebuild generated
assets so they support the current widget options.

## HTML and editing

`setHtml()` imports HTML into CKEditor's model; `getHtml()` returns the HTML
produced by `editor.getData()`, including current source edits. The package does
not convert it to Markdown, Delta, or a custom document format.

Included features: paragraph, heading, source editing, hyperlinks, bulleted and numbered lists, bold, italic, underline,
strikethrough, font family/size/color/background, highlight, subscript,
superscript, horizontal line, show blocks, special characters, alignment, and
block indentation. Images, uploads, and General HTML Support are not enabled.
Unsupported tags or attributes can be normalized or removed by the model.

`onChanged` delivers the complete HTML after debounce. Always read `getHtml()`
at save time so the latest changes and source edits are included.

Using the same CKEditor version, plugins, and configuration helps preserve
formatting, but compatibility with a particular web custom build must still be
verified by repeated Web → App → Web round trips. String identity is not
required; formatting after CKEditor normalization is what matters.

## Platform setup

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

## License

This package is licensed under **GPL-2.0-or-later**. See [LICENSE](LICENSE)
for the full text and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for
component notices. CKSource commercial agreements apply to the covered CKEditor
software and do not change this Flutter package's license.

When redistributing GPL-covered code, preserve the applicable notices and provide
the corresponding source for the distributed version, including modifications
and build inputs. App distributors are responsible for their app-specific source
and notice requirements.

Bundled-editor source downloads for package **0.1.0**:

- [Source archive](https://github.com/hyungraelee/ckeditor_webview_flutter/releases/download/v0.1.0/ckeditor_webview_flutter-0.1.0-sources.tar.gz)
- [SHA-256 checksum](https://github.com/hyungraelee/ckeditor_webview_flutter/releases/download/v0.1.0/ckeditor_webview_flutter-0.1.0-sources.tar.gz.sha256)

The archive contains the package sources, pinned upstream sources, notices, and
offline rebuild inputs for the bundled 41.4.1 editor. It is a separate download
and is not included in your app. See [source rebuild instructions](tool/release/SOURCE_ARCHIVE.md).
