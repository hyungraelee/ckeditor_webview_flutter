# CKEditor Flutter example

An Android/iOS app that uses `ckeditor_webview_flutter` through a local path
dependency. The editor assets are provided by the package; no separate asset
registration or web server is needed. Optional system-language UI translations
are fetched from CKEditor's official CDN, with English used offline or on failure.

The example uses the same minimum SDK constraints as the package: Flutter
3.27.0 and Dart 3.6. Its native scaffold is based on Flutter 3.27.0. The
repository's `.fvmrc` pins that version for development and minimum-SDK checks.

## Run

From the repository root:

```sh
fvm use 3.27.0
cd example
fvm flutter pub get
fvm flutter devices
fvm flutter run -d <device-id>
```

FVM commands in `example/` use the configuration in the repository root. Commit
`.fvmrc` to share the version; `.fvm/` contains local SDK links and is ignored.
Without FVM, use a compatible Flutter SDK and run the equivalent `flutter`
commands.

For an IDE debugger, open `example/` as the Flutter project, select an Android
or iOS device, and launch `lib/main.dart` (`example/lib/main.dart` from the
repository root). Set the IDE's Flutter SDK to the repository root's
`.fvm/flutter_sdk`; relative to `example/`, that path is `../.fvm/flutter_sdk`.

Use JDK 17 or JDK 21 for Android builds. The Android scaffold uses AGP 8.11.1,
Gradle 8.13, Kotlin 2.1.10, and NDK 27.0.12077973 to match the WebView
implementation resolved with Flutter 3.27.0. Install that NDK version through
the Android SDK Manager if it is not available. These build-tool versions do
not change the Flutter SDK requirement. See the
[AGP compatibility requirements](https://developer.android.com/build/releases/agp-8-11-0-release-notes).

For a physical iOS device, configure your own signing team and a suitable
bundle identifier for the Runner target in Xcode before running. The project
does not include a development team. Simulator execution does not require
device signing.

## Use

- Choose **Fixed height** or **Automatic height**.
- Fixed height uses default feature settings. Automatic height also demonstrates
  custom font families, sizes (12, 16, 20, 24, and default), and a three-color
  text palette through `config`. This configuration is independent of height
  mode; either mode can use it in an application. Font family/size options use
  `supportAllValues` to preserve imported values beyond the menu choices.
- Automatic height also uses `customCss` for a pale indigo toolbar, rounded
  borders, a warm content background, and custom default font/line height/padding.
  Fixed height keeps the original appearance. CSS customization works with
  either height mode; it is not written into the HTML output.
- Automatic height includes a link button and `https://` as the default URL
  protocol. Select text to add a link, or place the caret in the sample link to
  edit its URL or remove it. Fixed height keeps the package's default toolbar;
  the sample link remains preserved in its HTML.
- Edit the sample document and use **Get HTML** below the editor to read
  `getHtml()`. Selectable HTML appears below the button, including source-editing
  data. Scroll the page to view the full output.
- Go back and open either mode again to check a fresh editor session. Each
  screen owns and disposes its controller. Content is not persisted on exit.

HTML is read explicitly with `getHtml()` rather than saved from `cachedHtml`.
Unsupported tags and attributes can be normalized or removed by CKEditor.

## Device checks

Dependency resolution, Dart analysis, and the Dart/asset bundle build are checked
with Flutter 3.27.0 / Dart 3.6.0. Android Gradle configuration is checked with
`./gradlew help --no-daemon` on JDK 21. Native builds and device behavior still
require verification; passing these checks alone does not confirm Android/iOS
runtime compatibility.

These checks require manual execution on Android/iOS:

- Local assets load and toolbar/dropdown menus work.
- Online, the editor UI follows the system language when an official 41.4.1
  translation is available. Fully exit and relaunch after changing system language.
- Offline, a newly opened editor uses English and remains editable. The example
  declares Android INTERNET permission for online translations in release builds.
- Selection, formatting, toolbar overflow, and source editing work.
- Automatic height shows the configured font menus and palette. Choose a size
  and color, then read HTML to check that the selected formatting is included.
- Automatic height shows the custom toolbar/content appearance. Check menus,
  selection, source editing, long-content growth, and caret visibility after
  styling. HTML output must not contain the custom stylesheet or wrapper UI.
- HTML retrieval includes the latest edits, including source-editing changes.
- Add, edit, and remove links in automatic-height mode. Verify the link balloon
  stays usable with the keyboard open and that Get HTML contains the current URL.
- Fixed height scrolls inside the editor; automatic height grows and the parent
  page scrolls. Add paragraphs and edit near the bottom with the keyboard open
  to check caret visibility.
- Leaving and reopening a screen initializes a fresh editor without errors.

This example does not establish compatibility with a web custom build. See the
package README and third-party notices for HTML limitations and licensing.
