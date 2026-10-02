# CKEditor Flutter example

An Android/iOS app that uses `ckeditor_webview_flutter` through a local path
dependency. The editor assets are provided by the package; no separate asset
registration, web server, or runtime CDN is needed.

The native project scaffold was generated with Flutter 3.44.1. Use Flutter
3.44.1 or later for this example. The package itself keeps its existing SDK
constraints.

## Run

From the repository root:

```sh
cd example
flutter pub get
flutter devices
flutter run -d <device-id>
```

For an IDE debugger, open `example/` as the Flutter project, select an Android
or iOS device, and launch `lib/main.dart`.

For a physical iOS device, configure your own signing team and a suitable
bundle identifier for the Runner target in Xcode before running. The project
does not include a development team. Simulator execution does not require
device signing.

## Use

- Choose **고정 높이** (fixed height) or **자동 높이** (automatic height).
- Edit the sample document and use **HTML 가져오기** to read `getHtml()` into
  the HTML field below the editor. This also reads source-editing data.
- Enter HTML in that field and use **입력한 HTML 불러오기** to call `setHtml()`.
- Use **샘플 불러오기** or **긴 문서 불러오기** to load a formatted or long
  document. Loading HTML replaces the current document.
- Toggle **읽기 전용** to exercise the widget's `readOnly` option.
- Go back and open either mode again to check a fresh editor session. Each
  screen owns and disposes its controller. Content is not persisted on exit.

The change-event counter illustrates `onChanged`; HTML is read explicitly with
`getHtml()` rather than saved from `cachedHtml`. Unsupported tags and attributes
can be normalized or removed by CKEditor.

## Device checks

These checks require manual execution on Android/iOS:

- Local assets load and Korean toolbar/dropdown menus work.
- Selection, formatting, toolbar overflow, and source editing work.
- HTML retrieval includes the latest edits, including source-editing changes.
- Read-only mode blocks editing and switching it off restores editing.
- Fixed height scrolls inside the editor; automatic height grows and the parent
  page scrolls. Use the long sample and edit near the bottom with the keyboard
  open to check caret visibility.
- Leaving and reopening a screen initializes a fresh editor without errors.

This example does not establish compatibility with a web custom build. See the
package README and third-party notices for HTML limitations and licensing.
