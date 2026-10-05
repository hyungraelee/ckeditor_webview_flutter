# Contributing

This guide covers repository checks and rebuilding the bundled editor. For
application setup and the public API, see [README.md](README.md).

## Automated tests

From the repository root:

```sh
fvm flutter pub get
fvm flutter test
node --test test/editor_bridge_test.cjs
fvm flutter analyze
```

Without FVM, use equivalent commands with a compatible Flutter SDK. Flutter
tests cover controller readiness, command ordering, JSON/HTML transport,
snapshots, failure recovery, timeouts, detach/re-attach, and disposal through a
fake JavaScript execution boundary.

The independent bridge suite requires Node.js 20+ and uses Node's built-in test
runner, with no npm installation or editor rebuild. It executes the actual
`assets/editor/editor.js` in an isolated VM with an editor/DOM harness and
deterministic timers. It covers source-editing reads, debounced changes,
configuration protection, CSS text insertion, and failure/disposal cleanup.
Node is required only to run this suite or use optional engine builds; bundled
package use and the Flutter tests do not require it.

These tests do not run the real CKEditor model or native WebView. Passing them
does not establish HTML normalization/round-trip compatibility, actual CSS
rendering, or Android/iOS keyboard, selection, scrolling, and platform-view
lifecycle behavior. Continue manual device and web/app round-trip checks.

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
Default usage retains CKEditor's feature settings and the package's layout CSS;
the widget can customize features with `config` and appearance with `customCss`.

## Manual validation

Run the example on Android and iOS to check asset loading, toolbar menus,
selection, source editing, fixed and automatic height, keyboard/caret visibility,
and leaving and reopening the editor screen. Verify visual styles on both
platforms. Automated harnesses do not establish native WebView behavior.

For HTML compatibility, repeat Web → App → Web round trips with the actual web
editor build, matching engine versions, plugins, and feature settings where
possible. Check preserved formatting after normalization rather than identical
HTML strings.

Preserve upstream license notices when rebuilding or distributing assets. Build
scripts, lockfiles, and upstream links alone do not satisfy complete
corresponding-source distribution obligations. See
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
