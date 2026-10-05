## 0.1.0

- Add opt-in Node.js/npm engine builds through a Flutter asset transformer, with an initial 42.x adapter, persistent npm locks, cached local HTML assets, and explicit updates.
- Add an `init --version` command that creates the editor input asset and registers the transformer while preserving unrelated pubspec settings and comments.
- Add `editorAsset` for generated local editors and version-matched UMD UI translations; default bundled use still requires no Node.js/npm.

- Extract the standalone Flutter controller and local WebView editor.
- Bundle CKEditor 5 41.4.1 with English UI and default feature configuration.
- Fetch official 41.4.1 UI translations for the system locale, with a three-second network timeout and offline English fallback.
- Support HTML commands, debounced events, read-only mode, and source editing.
- Add configurable toolbar items, order, and group separators with documented supported names.
- Preserve readiness handling, lifecycle snapshots, error handling, and navigation restrictions.
- Support fixed height and automatic content height with caret visibility handling.
- Replace application-specific logging and widgets with callbacks and Flutter UI.
- Add an Android/iOS example app with height modes, sample content, and inline HTML output.
- Align the example's SDK constraints and native scaffold with Flutter 3.27.0, and pin the development SDK with FVM.
- Import internal annotations directly from meta for compatibility with Flutter 3.27.0.
