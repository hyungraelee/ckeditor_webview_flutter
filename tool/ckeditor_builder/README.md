# Optional CKEditor version builder

This tool is an opt-in Flutter asset transformer. The default widget still uses
its bundled CKEditor 41.4.1 and never invokes Node.js/npm. The public default
engine version can be reassessed independently of this build tool.

The builder accepts stable numeric npm requests across major versions:
`41.4.1`, `^43.0.0`, `~44.0.0`, `48.x`, and `48.5.x`, for example. Tags, URLs,
prereleases, and compound ranges are not accepted. There is no major-version
whitelist. It uses the same plugin and toolbar contract as the default editor.
Releases must supply those plugins and a compatible source/export layout; npm
or bundler failures report missing versions or incompatible dependencies.
Build support is not a claim of device or web round-trip compatibility for
every historical or future release.

## Application setup

Install Node.js 20 or newer and npm on each developer machine and CI runner
that uses this feature. Keep Node on a maintained release compatible with your
CI; no Node runtime is required on Android/iOS devices. The tool does not install
Node automatically or run during `flutter pub get`.

After adding the package dependency and running `flutter pub get`, run from
the consuming app root:

```sh
dart run ckeditor_webview_flutter init --version "^42.0.0"
```

The command creates `assets/ckeditor.html` and registers the following
configuration in the app's `pubspec.yaml`. Existing unrelated settings and
comments are preserved. Repeating the same command does not duplicate assets.
It refuses to overwrite existing user HTML or conflicting transformer entries.
Choose another location with `--asset assets/custom_editor.html` if needed.
Initialization does not invoke Node/npm or install the editor.

```yaml
ckeditor_webview_flutter:
  editor_version: '^42.0.0'

flutter:
  assets:
    - path: assets/ckeditor.html
      transformers:
        - package: ckeditor_webview_flutter
```

Set `editorAsset` on each widget that should use the generated editor. This is
one application Dart change during initial setup; the command prints the option
but does not rewrite application Dart files. Use the path printed by `init` if
you supplied `--asset`:

```dart
CkEditorWebView(
  controller: controller,
  editorAsset: 'assets/ckeditor.html',
  toolbarItems: const ['heading', '|', 'bold', 'italic', '|', 'sourceEditing'],
)
```

Run `flutter pub get`, then use the debugger, `flutter run`, or `flutter build`
as usual. Flutter invokes the transformer during asset bundling. On the first
build, npm resolves the request and the selected toolchain produces a self-contained local
HTML document. It contains the JS, CSS, package bridge, engine metadata, and
third-party notices. The placeholder source file remains unchanged. No remote
editor code is loaded at runtime.

If no `editorAsset` is supplied, the widget follows the existing bundled path;
the version setting alone does not activate or change the default editor.

The generated input file contains only the marker
`<!-- ckeditor_webview_flutter:generated -->`. Commit it and the updated
`pubspec.yaml`; users do not need to author editor HTML or JavaScript.
For manual configuration, the same marker and registration shown above work
without running `init`.

See Flutter's [asset transformer documentation](https://docs.flutter.dev/ui/assets/asset-transformation).
The transformer invocation mechanism also exists in the project's Flutter 3.27
SDK. Actual platform behavior still requires device verification.

## Lockfile and cache

After a successful build, commit **`ckeditor_webview_flutter.lock`** at the app
root. It is an npm-format lockfile containing the resolved engine, all package
versions, integrity hashes, and the original version request. `^` and wildcard
requests are resolved once, not refreshed during ordinary application builds.
An existing lock is restored with `npm ci` when the local dependencies are
missing. A mismatched version request/compiler requires an explicit update.

Dependencies and generated files are cached under
`.dart_tool/ckeditor_webview_flutter/`. This folder belongs in `.gitignore`.
`dist/build-info.json` records the exact engine version, package versions, and
artifact hash; `dist/THIRD_PARTY_NOTICES.json` retains the installed license
texts. Cached HTML is reused only if its fingerprint and hash match. The cache
is disposable; the application lockfile is persistent.

The first build and dependency restoration require registry access. A complete
warm cache can be reused without npm installation. English editing remains
local at runtime. Optional UI translations use the actual resolved version's
official UMD translation endpoint and fall back to English on failure.

## Explicit updates

After changing the requested version, or to refresh a version range, run:

```sh
dart run ckeditor_webview_flutter --update
flutter clean
flutter run
```

Use `fvm dart` and `fvm flutter` when your app uses FVM. `flutter clean` makes
Flutter re-run the asset transformer after the external lockfile changes.
The update command uses the same configuration, rebuilds the cache, and replaces
the persistent lock only after a successful build. Commit the changed lockfile
and verify the new engine on devices before release.

A build-lock file prevents concurrent npm operations in the same cache. If a
process is forcibly terminated, confirm no other build is running before
removing `.dart_tool/ckeditor_webview_flutter/build.lock`.

## Compatibility and licensing

The builder keeps editor packages on one exact version and supplies the expected
editor/plugin exports. Releases before 42 use the existing source-import webpack
recipe and its pinned build tools. Releases from 42 use the modern npm exports,
CSS, and esbuild with an ES2020 target. These build checks do
not verify WebView support on older operating systems, keyboard/selection,
auto-height, source editing, navigation, or the consuming web editor's HTML.
Windows Node/npm discovery is implemented but requires a Windows build check.

The optional widget `licenseKey` defaults to `'GPL'` and is passed at runtime
to generated releases from 44; earlier releases do not receive that option.
Override it with a self-hosted CKEditor commercial key when appropriate.
The default requires GPL-compliant use and follows the
[official initialization requirements](https://ckeditor.com/docs/ckeditor5/latest/getting-started/installation/self-hosted/quick-start.html).
The builder never stores application key values in generated HTML, metadata,
or lockfiles and does not enable premium plugins. The app can supply
`const String.fromEnvironment('CKEDITOR_LICENSE_KEY', defaultValue: 'GPL')`
with Flutter's `--dart-define`, or use its own configuration. A CKEditor key
does not change this package's GPL license or grant a commercial package license.
Commercial key activation remains unverified.

Generated assets use protocol 2. Run `flutter clean` and rebuild after updating
the builder package so assets using an older initialization contract are replaced.
The widget rejects old assets instead of ignoring a caller's key override.

The generated artifact includes upstream license texts and does not change the
package's GPL-2.0-or-later terms. The cache, lockfile, and build recipe do not by
themselves complete GPL corresponding-source distribution. Plan that
source distribution for the actual engine and app release before publishing.

After changing the generated engine, stop and start the app again. Hot reload
does not replace an editor already running inside an existing WebView.

The default bundle's original build remains in `tool/ckeditor_build/` and is
not replaced by this tool. Newer installation methods are described in the
[CKEditor migration guide](https://ckeditor.com/docs/ckeditor5/latest/updating/nim-migration/migration-to-new-installation-methods.html).
