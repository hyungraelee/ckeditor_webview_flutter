// SPDX-License-Identifier: GPL-2.0-or-later

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';

import 'ckeditor_controller.dart';
import 'ckeditor_error.dart';
import 'ckeditor_translation_loader.dart';

/// A local CKEditor DOM inside a native WebView, separate from Flutter's tree.
/// In a scrolling form set height (e.g. 360). In a full-screen SafeArea or
/// Expanded, omit height to fill the available space. Unbounded height uses 360.
/// For autoHeight, place the widget in a Flutter scroll view with unbounded
/// vertical constraints so it can grow beyond the visible screen.
class CkEditorWebView extends StatefulWidget {
  const CkEditorWebView({
    super.key,
    required this.controller,
    this.initialHtml = '',
    this.readOnly = false,
    this.toolbarItems,
    this.config,
    this.customCss,
    this.editorAsset,
    this.licenseKey = 'GPL',
    this.height,
    this.autoHeight = false,
    this.minHeight = 300,
    this.changeDebounce = const Duration(milliseconds: 300),
    this.onReady,
    this.onChanged,
    this.onFocus,
    this.onBlur,
    this.onError,
    this.onNavigationBlocked,
    this.loadingBuilder,
    this.errorBuilder,
  }) : assert(height == null || height > 0),
       assert(minHeight > 0 && minHeight < double.infinity),
       assert(changeDebounce >= Duration.zero);

  final CkEditorController controller;

  /// Initial seed only. Later content changes must use controller.setHtml().
  /// Remounting the same controller restores its cachedHtml instead of this seed.
  final String initialHtml;
  final bool readOnly;

  /// Toolbar buttons in display order, with `'|'` as a group separator.
  ///
  /// Supported item names (case-sensitive):
  /// - `'heading'`: paragraph and heading dropdown.
  /// - `'sourceEditing'`: HTML source editing.
  /// - `'bold'`, `'italic'`, `'underline'`, `'strikethrough'`: text styles.
  /// - `'fontFamily'`, `'fontSize'`: font dropdowns.
  /// - `'fontColor'`, `'fontBackgroundColor'`: text and background colors.
  /// - `'highlight'`: text highlight dropdown.
  /// - `'subscript'`, `'superscript'`: subscript and superscript styles.
  /// - `'horizontalLine'`: insert a horizontal line.
  /// - `'showBlocks'`: show block outlines.
  /// - `'specialCharacters'`: insert special characters.
  /// - `'alignment'`: text alignment dropdown.
  /// - `'outdent'`, `'indent'`: decrease and increase indentation.
  /// - `'undo'`, `'redo'`: undo and redo editing commands.
  /// - `'|'`: group separator; CKEditor cleans up redundant separators.
  ///
  /// For example: `const ['heading', '|', 'bold', 'italic', '|', 'sourceEditing']`.
  /// Null uses the package's default toolbar; an empty list shows no buttons.
  /// Items that overflow a narrow screen remain in CKEditor's grouping menu.
  /// Images, tables, custom buttons, and the `'-'` line break are not supported.
  /// Invalid names are reported through [onError].
  ///
  /// Hiding a button keeps its plugin enabled, preserving supported HTML.
  /// Applied when the local editor is created, including recreation/retry.
  /// Changes after initialization take effect on the next editor creation.
  /// Treat the list as immutable.
  final List<String>? toolbarItems;

  /// JSON-compatible CKEditor feature options, using CKEditor's option names.
  ///
  /// Supported top-level keys:
  /// - `'heading'`: heading options (model, view, title, and class).
  /// - `'fontFamily'`: font options and supportAllValues; fonts are not bundled.
  /// - `'fontSize'`: size options and supportAllValues (numeric sizes only).
  /// - `'fontColor'`, `'fontBackgroundColor'`: palettes, columns, and picker.
  /// - `'highlight'`: marker/pen options.
  /// - `'alignment'`: available text alignments.
  /// - `'indentBlock'`: offset/unit or configured indentation classes.
  /// - `'specialCharacters'`: order of the included character groups.
  /// - `'placeholder'`: empty-editor placeholder text.
  ///
  /// For example: `const {'fontSize': {'options': [12, 16, 20, 'default'],
  /// 'supportAllValues': true}, 'placeholder': 'Write here...'}`.
  /// Null or an empty map uses defaults. Omitted feature options retain
  /// CKEditor defaults. Nested option schemas depend on the engine version.
  /// Values must be null, booleans, strings, finite numbers, lists, or maps
  /// with string keys. Functions, plugin classes, cyclic values, dotted keys,
  /// and JavaScript prototype keys are not supported.
  ///
  /// Use [toolbarItems], [initialHtml], and [licenseKey] for those settings;
  /// plugins, language, translations, layout, and lifecycle remain managed by
  /// the package. Unsupported keys/values report `invalid_editor_config`
  /// through [onError]. Other invalid feature settings are handled by CKEditor.
  /// This does not add plugins or load fonts. Use [customCss] for visual styles.
  ///
  /// Applied on editor creation/retry, like [toolbarItems]. Changes do not
  /// recreate an active editor; treat the map and nested values as immutable.
  /// With [editorAsset], regenerate older assets with this package's builder.
  /// Restricting options can remove unsupported formatting from imported HTML.
  final Map<String, Object?>? config;

  /// Optional CSS for the editor UI and the displayed editing content.
  ///
  /// Null or an empty string preserves existing styles. Inserted as style text
  /// after bundled CSS, before editor creation; CSS cascade/specificity apply.
  /// Supply CSS rules only, without HTML `<style>` tags.
  ///
  /// Useful variables on `:root` include `--ck-color-toolbar-background`,
  /// `--ck-color-base-border`, `--ck-color-focus-border`, `--ck-border-radius`,
  /// and `--ck-font-size-base`. Use `#editor-container .ck-content` for content
  /// font, line height, background, and padding. Available selectors/variables
  /// depend on the selected CKEditor version. Flutter overlays are unaffected.
  ///
  /// CSS changes appearance only: [CkEditorController.getHtml] does not include
  /// this stylesheet or convert it into inline HTML. Apply matching content CSS
  /// on the publishing page. Existing inline document formatting still follows
  /// normal CSS precedence. Avoid overriding height, flex, or overflow rules
  /// used by fixed/automatic height, scrolling, and caret visibility.
  ///
  /// Relative CSS URLs resolve from the editor HTML asset, not the Flutter app
  /// root. Fonts/resources are not copied automatically; remote URLs/imports
  /// need network access. Invalid CSS is handled by the WebView's CSS parser.
  ///
  /// Applied on creation/retry, like [config]. Changes do not recreate an
  /// active editor. With [editorAsset], rebuild older generated assets with
  /// this package's builder before using non-empty CSS.
  final String? customCss;

  /// Optional self-contained HTML asset generated by the Node-based builder.
  ///
  /// Null uses the bundled CKEditor 41.4.1 without requiring Node.js/npm.
  /// For opt-in builds, run `dart run ckeditor_webview_flutter init --version
  /// "^42.0.0"` in the app root, then set this to the printed asset path
  /// (normally `'assets/ckeditor.html'`). The command creates the input and
  /// registers the transformer; it does not modify application Dart files.
  /// The generated asset must contain asset protocol 2 and a supported engine.
  /// Arbitrary web pages and remote URLs are not accepted.
  ///
  /// Use a relative `.html` asset key with letters, digits, underscores,
  /// hyphens, dots, and slashes. Changing this option recreates the WebView.
  /// Build support does not imply Android/iOS device-verified compatibility.
  final String? editorAsset;

  /// CKEditor activation value for generated engines that require a license key.
  ///
  /// Defaults to `'GPL'`, which requires GPL-compliant use. Supply a self-hosted
  /// commercial key when appropriate. A CKEditor key does not change this
  /// package's GPL license or grant a commercial license for the package.
  ///
  /// For example, an app can use `const String.fromEnvironment(
  /// 'CKEDITOR_LICENSE_KEY', defaultValue: 'GPL')` and `--dart-define`.
  /// Values are passed at initialization, never stored in generated editor
  /// assets or npm locks. Values embedded in an app are not secret storage.
  /// Empty/whitespace values report `invalid_license_key` through [onError]
  /// when the engine requires a key. Ignored by the bundled 41.4.1 engine and
  /// generated engines before 44. Changing this option recreates the WebView.
  final String licenseKey;

  final double? height;
  final bool autoHeight;

  /// Minimum total editor height (toolbar included) when autoHeight is enabled.
  final double minHeight;

  /// Applied when the local editor is created (including recreation/retry).
  final Duration changeDebounce;
  final VoidCallback? onReady;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onFocus;
  final VoidCallback? onBlur;
  final ValueChanged<CkEditorError>? onError;

  /// Navigation stays blocked; the caller may choose to open an external browser.
  final ValueChanged<Uri>? onNavigationBlocked;

  /// Replaces the loading overlay while the local editor initializes.
  final WidgetBuilder? loadingBuilder;

  /// Replaces the error view. Retry is null when the controller is disposed.
  final Widget Function(
    BuildContext context,
    CkEditorError error,
    VoidCallback? retry,
  )?
  errorBuilder;

  @override
  State<CkEditorWebView> createState() => _CkEditorWebViewState();
}

class _CkEditorWebViewState extends State<CkEditorWebView>
    with WidgetsBindingObserver {
  static const _assetKey =
      'packages/ckeditor_webview_flutter/assets/editor/index.html';
  String get _editorAssetKey => widget.editorAsset ?? _assetKey;
  WebViewController? _webView;
  CkEditorError? _setupError;
  Object? _owner;
  CkEditorController? _attachedController;
  Uri? _documentUrl;
  bool _pageStarted = false;
  bool _bridgeStarted = false;
  CkEditorLayout? _layout;
  bool _caretRevealPending = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    unawaited(_open());
  }

  bool _isCurrent(Object owner) => mounted && identical(_owner, owner);

  Future<void> _open() async {
    final owner = Object();
    final controller = widget.controller;
    _owner = owner;
    _documentUrl = null;
    _pageStarted = false;
    _bridgeStarted = false;
    _layout = null;
    try {
      final assetKey = _editorAssetKey;
      if (!RegExp(r'^[A-Za-z0-9_./-]+\.html$').hasMatch(assetKey) ||
          assetKey.split('/').any((part) =>
              part.isEmpty || part == '.' || part == '..')) {
        throw const CkEditorError(
          code: 'invalid_editor_asset',
          message: 'Use a relative HTML asset key without traversal or URL components.',
        );
      }
      final webView = WebViewController();
      controller.attach(
        owner: owner,
        execute: webView.runJavaScriptReturningResult,
        initialHtml: widget.initialHtml,
        onReady: () {
          if (_isCurrent(owner)) widget.onReady?.call();
        },
        onChanged: (html) {
          if (_isCurrent(owner)) widget.onChanged?.call(html);
        },
        onFocus: () {
          if (_isCurrent(owner)) widget.onFocus?.call();
        },
        onBlur: () {
          if (_isCurrent(owner)) widget.onBlur?.call();
        },
        onError: (error) {
          if (_isCurrent(owner)) widget.onError?.call(error);
        },
        onLayoutChanged: (layout) {
          if (!_isCurrent(owner) || !widget.autoHeight) return;
          final needsBuild =
              _layout?.height != layout.height ||
              _layout?.captureGestures != layout.captureGestures;
          _layout = layout;
          if (needsBuild) setState(() {});
          _scheduleCaretReveal();
        },
      );
      _attachedController = controller;
      _webView = webView;
      await webView.setJavaScriptMode(JavaScriptMode.unrestricted);
      if (!_isCurrent(owner)) return;
      await webView.setBackgroundColor(Colors.white);
      if (!_isCurrent(owner)) return;
      await webView.addJavaScriptChannel(
        'CkEditorChannel',
        onMessageReceived: (message) {
          if (_isCurrent(owner)) {
            controller.handleMessage(owner, message.message);
          }
        },
      );
      if (!_isCurrent(owner)) return;
      await webView.setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            if (!_isCurrent(owner)) return NavigationDecision.prevent;
            final uri = Uri.tryParse(request.url);
            if (uri != null &&
                _isEditorDocument(uri) &&
                (_documentUrl == null ||
                    uri.replace(fragment: '') == _documentUrl)) {
              return NavigationDecision.navigate;
            }
            if (uri != null) widget.onNavigationBlocked?.call(uri);
            return NavigationDecision.prevent;
          },
          onPageStarted: (url) {
            if (!_isCurrent(owner)) return;
            final uri = Uri.tryParse(url);
            if (uri == null || !_isEditorDocument(uri)) {
              controller.reportError(
                owner,
                const CkEditorError(
                  code: 'navigation_blocked',
                  message: '허용되지 않은 에디터 페이지입니다.',
                ),
                fatal: true,
              );
              return;
            }
            if (_pageStarted) {
              controller.reportError(
                owner,
                const CkEditorError(
                  code: 'webview_reloaded',
                  message: '에디터 페이지가 변경되었습니다. 다시 시도해주세요.',
                ),
                fatal: true,
              );
              return;
            }
            _pageStarted = true;
            _documentUrl = uri.replace(fragment: '');
          },
          onPageFinished: (url) {
            if (!_isCurrent(owner) || _bridgeStarted) return;
            final uri = Uri.tryParse(url);
            if (uri == null || !_isEditorDocument(uri)) return;
            _bridgeStarted = true;
            unawaited(
              _initializeEditor(owner, controller, webView),
            );
          },
          onWebResourceError: (error) {
            if (!_isCurrent(owner) || error.isForMainFrame == false) return;
            controller.reportError(
              owner,
              CkEditorError(
                code: 'webview_load_failed',
                message: '에디터 페이지를 불러오지 못했습니다.',
                cause: error,
              ),
              fatal: true,
            );
          },
        ),
      );
      if (!_isCurrent(owner)) return;
      await webView.loadFlutterAsset(assetKey);
    } catch (error) {
      if (!_isCurrent(owner)) return;
      final editorError = error is CkEditorError
          ? error
          : CkEditorError(
              code: 'webview_load_failed',
              message: '로컬 에디터를 불러오지 못했습니다.',
              cause: error,
            );
      if (identical(_attachedController, controller)) {
        controller.reportError(owner, editorError, fatal: true);
      } else {
        setState(() => _setupError = editorError);
        widget.onError?.call(editorError);
      }
    }
  }

  bool _isEditorDocument(Uri uri) =>
      uri.scheme == 'file' &&
      uri.host.isEmpty &&
      !uri.hasQuery &&
      uri.normalizePath().path.endsWith('/flutter_assets/$_editorAssetKey');

  Future<void> _initializeEditor(
    Object owner,
    CkEditorController controller,
    WebViewController webView,
  ) async {
    var version = '41.4.1';
    var modern = false;
    var requiresLicenseKey = false;
    if (widget.editorAsset != null) {
      try {
        Object? info = await webView.runJavaScriptReturningResult(
          'JSON.stringify(window.CKEDITOR_BUNDLE_INFO ?? null)',
        );
        if (!_isCurrent(owner)) return;
        for (var i = 0; i < 2 && info is String; i++) {
          info = jsonDecode(info);
        }
        if (info is! Map<String, dynamic> ||
            info['protocol'] != 2 ||
            info['version'] is! String ||
            !RegExp(r'^\d+\.\d+\.\d+$').hasMatch(info['version'] as String)) {
          throw const FormatException('Unsupported generated editor metadata.');
        }
        version = info['version'] as String;
        final major = int.parse(version.split('.').first);
        modern = major >= 42;
        requiresLicenseKey = major >= 44;
        if (info['translationFormat'] != (modern ? 'umd' : 'legacy')) {
          throw const FormatException(
            'Incompatible editor translation metadata.',
          );
        }
        if (widget.config?.isNotEmpty == true &&
            info['supportsConfig'] != true) {
          throw const FormatException(
            'Generated asset does not support feature config. Rebuild it.',
          );
        }
        if (widget.customCss?.isNotEmpty == true &&
            info['supportsCustomCss'] != true) {
          throw const FormatException(
            'Generated asset does not support custom CSS. Rebuild it.',
          );
        }
      } catch (error) {
        if (_isCurrent(owner)) {
          controller.reportError(
            owner,
            CkEditorError(
              code: 'invalid_editor_bundle',
              message: 'Rebuild the asset with the compatible package builder. '
                  'Run flutter clean first.',
              cause: error,
            ),
            fatal: true,
          );
        }
        return;
      }
    }
    if (requiresLicenseKey && widget.licenseKey.trim().isEmpty) {
      controller.reportError(
        owner,
        const CkEditorError(
          code: 'invalid_license_key',
          message: 'Supply GPL or a valid self-hosted CKEditor license key.',
        ),
        fatal: true,
      );
      return;
    }
    final translation = await loadCkEditorTranslation(
      WidgetsBinding.instance.platformDispatcher.locale,
      version: version,
      modern: modern,
    );
    if (!_isCurrent(owner)) return;
    var uiLanguage = 'en';
    if (translation.script != null) {
      try {
        final registered = await webView.runJavaScriptReturningResult(
          '(() => { ${translation.script}\n'
          'return !!window.CKEDITOR_TRANSLATIONS?.'
          '[${jsonEncode(translation.language)}]?.dictionary; })()',
        );
        if (registered == true) uiLanguage = translation.language;
      } catch (_) {
        // A failed translation must not prevent the local English editor.
      }
    }
    if (!_isCurrent(owner)) return;
    await controller.initialize(
      owner,
      readOnly: widget.readOnly,
      changeDebounce: widget.changeDebounce,
      autoHeight: widget.autoHeight,
      minHeight: widget.minHeight,
      uiLanguage: uiLanguage,
      toolbarItems: widget.toolbarItems,
      config: widget.config,
      customCss: widget.customCss,
      licenseKey: requiresLicenseKey ? widget.licenseKey : null,
    );
  }

  @override
  void didUpdateWidget(CkEditorWebView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!identical(oldWidget.controller, widget.controller) ||
        oldWidget.editorAsset != widget.editorAsset ||
        oldWidget.licenseKey != widget.licenseKey ||
        oldWidget.autoHeight != widget.autoHeight ||
        oldWidget.minHeight != widget.minHeight) {
      _close();
      _setupError = null;
      unawaited(_open());
    } else if (oldWidget.readOnly != widget.readOnly &&
        _attachedController != null) {
      unawaited(_updateReadOnly());
    }
  }

  @override
  void didChangeMetrics() {
    _scheduleCaretReveal();
  }

  void _scheduleCaretReveal() {
    if (!widget.autoHeight ||
        _layout?.caretBottom == null ||
        _caretRevealPending) {
      return;
    }
    _caretRevealPending = true;
    final owner = _owner;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _caretRevealPending = false;
      if (owner == null || !_isCurrent(owner) || _layout?.caretBottom == null) {
        return;
      }
      final scrollable = Scrollable.maybeOf(context);
      final editorBox = context.findRenderObject();
      final viewport = scrollable?.context.findRenderObject();
      if (scrollable == null ||
          editorBox is! RenderBox ||
          viewport is! RenderBox ||
          !editorBox.hasSize ||
          !viewport.hasSize ||
          scrollable.axisDirection != AxisDirection.down) {
        return;
      }
      final position = scrollable.position;
      if (!position.hasContentDimensions ||
          position.isScrollingNotifier.value) {
        return;
      }
      final origin = editorBox.localToGlobal(Offset.zero).dy;
      final viewportTop = viewport.localToGlobal(Offset.zero).dy;
      final viewportBottom = viewportTop + viewport.size.height;
      final media = MediaQuery.of(context);
      final keyboardTop = media.size.height - media.viewInsets.bottom;
      final visibleBottom = viewportBottom < keyboardTop
          ? viewportBottom
          : keyboardTop;
      final caretTop = origin + _layout!.caretTop!;
      final caretBottom = origin + _layout!.caretBottom!;
      final delta = caretBottom > visibleBottom - 20
          ? caretBottom - visibleBottom + 20
          : caretTop < viewportTop + 20
          ? caretTop - viewportTop - 20
          : 0.0;
      if (delta.abs() < 1) return;
      final target = (position.pixels + delta)
          .clamp(position.minScrollExtent, position.maxScrollExtent)
          .toDouble();
      if ((target - position.pixels).abs() >= 1) position.jumpTo(target);
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  Future<void> _updateReadOnly() async {
    try {
      await widget.controller.setReadOnly(widget.readOnly);
    } on CkEditorError {
      // The controller has already forwarded the error to onError.
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.inactive &&
        _attachedController?.isReady == true) {
      unawaited(_snapshot(_attachedController!));
    }
  }

  Future<void> _snapshot(CkEditorController controller) async {
    try {
      await controller.getHtml();
    } on CkEditorError {
      // A background snapshot is best-effort; save explicitly before leaving.
    }
  }

  void _close() {
    final owner = _owner;
    _owner = null;
    if (owner != null) _attachedController?.detach(owner);
    _attachedController = null;
    _webView = null;
  }

  void _retry() {
    _close();
    setState(() => _setupError = null);
    unawaited(_open());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _close();
    // Controller ownership belongs to the using screen, allowing remounts.
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) => SizedBox(
      height: widget.autoHeight
          ? (_layout?.height ?? widget.minHeight).clamp(
              widget.minHeight,
              double.infinity,
            )
          : widget.height ?? (constraints.hasBoundedHeight ? null : 360),
      child: ListenableBuilder(
        listenable: widget.controller,
        builder: (context, child) {
          final controller = widget.controller;
          final error =
              _setupError ??
              (controller.state == CkEditorState.error
                  ? controller.error
                  : null);
          if (error != null || controller.state == CkEditorState.disposed) {
            final displayedError =
                error ??
                const CkEditorError(
                  code: 'disposed',
                  message: 'The editor controller is disposed.',
                );
            final retry = controller.state == CkEditorState.disposed
                ? null
                : _retry;
            return widget.errorBuilder?.call(context, displayedError, retry) ??
                ColoredBox(
                  color: Colors.white,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      children: [
                        Expanded(
                          child: Center(
                            child: Text(
                              displayedError.message,
                              textAlign: TextAlign.center,
                            ),
                          ),
                        ),
                        if (retry != null)
                          FilledButton(
                            onPressed: retry,
                            child: const Text('Retry'),
                          ),
                      ],
                    ),
                  ),
                );
          }
          return Stack(
            fit: StackFit.expand,
            children: [
              if (_webView != null)
                IgnorePointer(
                  ignoring: !controller.isReady,
                  child: WebViewWidget(
                    key: ObjectKey(_webView),
                    controller: _webView!,
                    // In autoHeight mode vertical swipes scroll the Flutter
                    // form. Native selection and open menus retain gestures.
                    gestureRecognizers:
                        widget.autoHeight &&
                            !(_layout?.captureGestures ?? false)
                        ? {
                            Factory<OneSequenceGestureRecognizer>(
                              () => LongPressGestureRecognizer(),
                            ),
                          }
                        : {
                            Factory<OneSequenceGestureRecognizer>(
                              () => EagerGestureRecognizer(),
                            ),
                          },
                  ),
                ),
              if (!controller.isReady)
                ColoredBox(
                  color: Colors.white,
                  child:
                      widget.loadingBuilder?.call(context) ??
                      const Center(child: CircularProgressIndicator()),
                ),
            ],
          );
        },
      ),
    ),
  );
}
