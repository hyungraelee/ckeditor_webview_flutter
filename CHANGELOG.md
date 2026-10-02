## 0.1.0

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
