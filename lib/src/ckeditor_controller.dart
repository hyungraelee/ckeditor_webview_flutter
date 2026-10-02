// SPDX-License-Identifier: GPL-2.0-or-later

import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'ckeditor_error.dart';

enum CkEditorState { notInitialized, loading, ready, error, disposed }

/// The names match EVENT in assets/editor/editor.js.
enum CkEditorEventType { ready, change, focus, blur, resize, error }

/// UI geometry only; it never changes the saved document HTML.
typedef CkEditorLayout = ({
  double height,
  double? caretTop,
  double? caretBottom,
  bool captureGestures,
});

/// Own this controller in the using screen and dispose it with that screen.
/// One controller can be attached to only one editor at a time.
/// API futures throw [CkEditorError]; errors also reach the widget's onError.
class CkEditorController extends ChangeNotifier {
  CkEditorController({
    this.readyTimeout = const Duration(seconds: 15),
    this.commandTimeout = const Duration(seconds: 10),
  }) {
    if (readyTimeout <= Duration.zero || commandTimeout <= Duration.zero) {
      throw ArgumentError('Editor timeouts must be positive.');
    }
  }

  final Duration readyTimeout;
  final Duration commandTimeout;

  CkEditorState _state = CkEditorState.notInitialized;
  CkEditorError? _error;
  String? _cachedHtml;
  int _htmlRevision = 0;
  Completer<void> _ready = _createReady();
  Future<void> _commandTail = Future<void>.value();
  Timer? _readyTimer;
  _EditorSession? _session;
  VoidCallback? _onReady;
  ValueChanged<String>? _onChanged;
  VoidCallback? _onFocus;
  VoidCallback? _onBlur;
  ValueChanged<CkEditorError>? _onError;
  ValueChanged<CkEditorLayout>? _onLayoutChanged;

  CkEditorState get state => _state;
  CkEditorError? get error => _error;
  bool get isReady => _state == CkEditorState.ready;

  /// A best-effort snapshot for remounting this same controller. At save time,
  /// await getHtml() instead: this snapshot may lag input by the debounce delay.
  String? get cachedHtml => _cachedHtml;

  Future<void> get whenReady async {
    _checkDisposed();
    if (_state == CkEditorState.error) throw _error!;
    final ready = _ready.future;
    await ready.timeout(
      readyTimeout,
      onTimeout: () {
        throw const CkEditorError(
          code: 'ready_timeout',
          message: '에디터가 준비되지 않았습니다.',
        );
      },
    );
    _checkDisposed();
    if (!identical(ready, _ready.future)) {
      throw const CkEditorError(code: 'detached', message: '에디터 연결이 변경되었습니다.');
    }
    if (_state == CkEditorState.error) throw _error!;
  }

  Future<void> setHtml(String html) => _queue((session) async {
    final revision = _htmlRevision;
    await _send(session, 'setHtml', [html]);
    if (revision == _htmlRevision) _cachedHtml = html;
  });

  /// Reads the current model, including uncommitted SourceEditing textarea data.
  Future<String> getHtml() => _queue((session) async {
    final revision = _htmlRevision;
    final html = await _send(session, 'getHtml');
    if (html is! String) {
      throw const CkEditorError(
        code: 'invalid_bridge_result',
        message: '에디터가 올바른 HTML을 반환하지 않았습니다.',
      );
    }
    if (revision == _htmlRevision) _cachedHtml = html;
    return html;
  });

  Future<void> setReadOnly(bool readOnly) => _queue((session) async {
    await _send(session, 'setReadOnly', [readOnly]);
  });

  Future<void> focus() => _queue((session) async {
    await _send(session, 'focus');
  });

  Future<void> clear() => setHtml('');

  // These binding methods are only for CkEditorWebView. The using screen should
  // access the five HTML/editing APIs above, without managing JavaScript.
  @internal
  void attach({
    required Object owner,
    required Future<Object> Function(String) execute,
    required String initialHtml,
    VoidCallback? onReady,
    ValueChanged<String>? onChanged,
    VoidCallback? onFocus,
    VoidCallback? onBlur,
    ValueChanged<CkEditorError>? onError,
    ValueChanged<CkEditorLayout>? onLayoutChanged,
  }) {
    _checkDisposed();
    if (_session != null) {
      throw const CkEditorError(
        code: 'controller_already_attached',
        message: '하나의 Controller를 여러 에디터에 동시에 사용할 수 없습니다.',
      );
    }
    _session = _EditorSession(owner, execute);
    _cachedHtml ??= initialHtml;
    _onReady = onReady;
    _onChanged = onChanged;
    _onFocus = onFocus;
    _onBlur = onBlur;
    _onError = onError;
    _onLayoutChanged = onLayoutChanged;
    _error = null;
    _state = CkEditorState.loading;
    _readyTimer = Timer(readyTimeout, () {
      reportError(
        owner,
        const CkEditorError(
          code: 'ready_timeout',
          message: '에디터 초기화 시간이 초과되었습니다. 다시 시도해주세요.',
        ),
        fatal: true,
      );
    });
    notifyListeners();
  }

  @internal
  Future<void> initialize(
    Object owner, {
    required bool readOnly,
    required Duration changeDebounce,
    required bool autoHeight,
    required double minHeight,
  }) async {
    final session = _session;
    if (session == null ||
        !identical(session.owner, owner) ||
        _state != CkEditorState.loading) {
      return;
    }
    try {
      final options = jsonEncode({
        'initialHtml': _cachedHtml ?? '',
        'readOnly': readOnly,
        'changeDebounceMs': changeDebounce.inMilliseconds,
        'autoHeight': autoHeight,
        'minHeight': minHeight,
      });
      // Return a boolean, not a Promise (native WebViews do not await it).
      final result = await _execute(
        session,
        '(() => { if (!window.ckBridge) return false; '
        'void window.ckBridge.initialize($options); return true; })()',
      );
      if (result != true) {
        throw const CkEditorError(
          code: 'bridge_missing',
          message: '로컬 에디터 bridge를 불러오지 못했습니다.',
        );
      }
    } catch (error) {
      if (!identical(_session, session)) return;
      reportError(
        owner,
        _asError(error, 'bridge_initialize_failed', '에디터 초기화에 실패했습니다.'),
        fatal: true,
      );
    }
  }

  @internal
  void handleMessage(Object owner, String message) {
    if (!identical(_session?.owner, owner) ||
        _state == CkEditorState.error ||
        _state == CkEditorState.disposed) {
      return;
    }
    late CkEditorEventType type;
    String? html;
    CkEditorError? eventError;
    CkEditorLayout? layout;
    try {
      final json = jsonDecode(message);
      if (json is! Map<String, dynamic> || json['type'] is! String) {
        throw const FormatException('Invalid event envelope.');
      }
      type = CkEditorEventType.values.byName(json['type'] as String);
      if (type == CkEditorEventType.change) {
        final data = json['data'];
        if (data is! Map<String, dynamic> || data['html'] is! String) {
          throw const FormatException('Invalid change event.');
        }
        html = data['html'] as String;
      } else if (type == CkEditorEventType.error) {
        eventError = _decodeError(json['data']);
      } else if (type == CkEditorEventType.resize) {
        final data = json['data'];
        if (data is! Map<String, dynamic>) {
          throw const FormatException('Invalid resize event.');
        }
        final height = data['height'];
        final top = data['caretTop'];
        final bottom = data['caretBottom'];
        if (height is! num ||
            !height.isFinite ||
            height <= 0 ||
            (top != null && (top is! num || !top.isFinite)) ||
            (bottom != null && (bottom is! num || !bottom.isFinite)) ||
            (top == null) != (bottom == null) ||
            data['captureGestures'] is! bool) {
          throw const FormatException('Invalid editor geometry.');
        }
        layout = (
          height: height.toDouble(),
          caretTop: (top as num?)?.toDouble(),
          caretBottom: (bottom as num?)?.toDouble(),
          captureGestures: data['captureGestures'] as bool,
        );
      }
    } catch (error) {
      reportError(
        owner,
        CkEditorError(
          code: 'invalid_json_message',
          message: '에디터에서 잘못된 이벤트를 전달했습니다.',
          cause: error,
        ),
        fatal: _state == CkEditorState.loading,
      );
      return;
    }

    // User callbacks stay outside the JSON validation catch block.
    switch (type) {
      case CkEditorEventType.ready:
        if (_state != CkEditorState.loading) return;
        _readyTimer?.cancel();
        _state = CkEditorState.ready;
        _ready.complete();
        notifyListeners();
        _onReady?.call();
      case CkEditorEventType.change:
        if (!isReady) return;
        _cachedHtml = html!;
        _htmlRevision++;
        _onChanged?.call(html);
      case CkEditorEventType.focus:
        if (isReady) _onFocus?.call();
      case CkEditorEventType.blur:
        if (isReady) _onBlur?.call();
      case CkEditorEventType.resize:
        if (isReady) _onLayoutChanged?.call(layout!);
      case CkEditorEventType.error:
        reportError(
          owner,
          eventError!,
          fatal:
              _state == CkEditorState.loading ||
              const {
                'asset_load_failed',
                'javascript_error',
              }.contains(eventError.code),
        );
    }
  }

  @internal
  void reportError(Object owner, CkEditorError error, {bool fatal = false}) {
    if (!identical(_session?.owner, owner) ||
        _state == CkEditorState.disposed ||
        identical(_error, error)) {
      return;
    }
    _error = error;
    if (fatal) {
      _state = CkEditorState.error;
      _readyTimer?.cancel();
      if (!_ready.isCompleted) _ready.completeError(error);
      if (!_session!.ended.isCompleted) _session!.ended.complete(error);
    }
    notifyListeners();
    _onError?.call(error);
  }

  @internal
  void detach(Object owner) {
    if (!identical(_session?.owner, owner)) return;
    _endSession(
      const CkEditorError(code: 'detached', message: '에디터 화면이 닫혔습니다.'),
    );
    _ready = _createReady();
    _commandTail = Future<void>.value();
    _state = CkEditorState.notInitialized;
    _error = null;
    notifyListeners();
  }

  Future<T> _queue<T>(Future<T> Function(_EditorSession) action) {
    final ready = _ready.future;
    final result = _commandTail.then((_) async {
      try {
        _checkDisposed();
        await ready.timeout(
          readyTimeout,
          onTimeout: () {
            throw const CkEditorError(
              code: 'ready_timeout',
              message: '에디터가 준비되지 않았습니다.',
            );
          },
        );
        if (!identical(ready, _ready.future) || _session == null) {
          throw const CkEditorError(
            code: 'detached',
            message: '에디터 연결이 변경되었습니다.',
          );
        }
        if (!isReady) {
          throw _error ??
              const CkEditorError(
                code: 'editor_not_ready',
                message: '에디터가 준비되지 않았습니다.',
              );
        }
        return await action(_session!);
      } catch (error, stackTrace) {
        final editorError = _asError(
          error,
          'bridge_call_failed',
          '에디터 명령 실행에 실패했습니다.',
        );
        if (identical(ready, _ready.future) && _session != null) {
          reportError(
            _session!.owner,
            editorError,
            fatal: _state == CkEditorState.loading,
          );
        }
        Error.throwWithStackTrace(editorError, stackTrace);
      }
    });
    // A failed command must not block later commands or leave an unhandled
    // internal queue future. The returned API future still delivers the error.
    _commandTail = result.then<void>(
      (_) {},
      onError: (Object error, StackTrace stack) {},
    );
    return result;
  }

  Future<Object?> _send(
    _EditorSession session,
    String command, [
    List<Object?> args = const [],
  ]) async {
    final raw = await _execute(
      session,
      'window.ckBridge.invoke(${jsonEncode(command)}, ${jsonEncode(args)})',
    );
    try {
      Object? json = raw;
      // Android returns a quoted JSON string; iOS returns the JSON string itself.
      for (var i = 0; i < 2 && json is String; i++) {
        json = jsonDecode(json);
      }
      if (json is! Map<String, dynamic> || json['ok'] is! bool) {
        throw const FormatException('Invalid command envelope.');
      }
      if (json['ok'] == false) throw _decodeError(json['error']);
      if (!json.containsKey('data')) {
        throw const FormatException('Missing command data.');
      }
      return json['data'];
    } on CkEditorError {
      rethrow;
    } catch (error) {
      throw CkEditorError(
        code: 'invalid_bridge_result',
        message: '에디터 명령 응답을 해석하지 못했습니다.',
        cause: error,
      );
    }
  }

  Future<Object> _execute(_EditorSession session, String script) async {
    final result = await Future.any<Object>([
      session.execute(script).timeout(commandTimeout),
      session.ended.future.then<Object>((error) => throw error),
    ]);
    if (!identical(_session, session)) {
      throw const CkEditorError(code: 'detached', message: '에디터 연결이 변경되었습니다.');
    }
    if (session.ended.isCompleted) {
      throw _error ??
          const CkEditorError(code: 'detached', message: '에디터 연결이 종료되었습니다.');
    }
    return result;
  }

  void _endSession(CkEditorError error) {
    _readyTimer?.cancel();
    if (!_ready.isCompleted) _ready.completeError(error);
    final session = _session;
    _session = null;
    if (session != null) {
      if (!session.ended.isCompleted) session.ended.complete(error);
      unawaited(_destroy(session));
    }
    _onReady = null;
    _onChanged = null;
    _onFocus = null;
    _onBlur = null;
    _onError = null;
    _onLayoutChanged = null;
  }

  Future<void> _destroy(_EditorSession session) async {
    try {
      await session
          .execute('if (window.ckBridge) void window.ckBridge.destroy(); true;')
          .timeout(commandTimeout);
    } catch (_) {
      // Cleanup must also tolerate a WebView whose native view is already gone.
    }
  }

  void _checkDisposed() {
    if (_state == CkEditorState.disposed) {
      throw const CkEditorError(
        code: 'disposed',
        message: '종료된 에디터 Controller입니다.',
      );
    }
  }

  static Completer<void> _createReady() {
    final completer = Completer<void>();
    unawaited(
      completer.future.then<void>(
        (_) {},
        onError: (Object error, StackTrace stack) {},
      ),
    );
    return completer;
  }

  static CkEditorError _decodeError(Object? data) {
    if (data is! Map<String, dynamic> ||
        data['code'] is! String ||
        data['message'] is! String) {
      throw const FormatException('Invalid editor error.');
    }
    return CkEditorError(
      code: data['code'] as String,
      message: data['message'] as String,
    );
  }

  static CkEditorError _asError(Object error, String code, String message) {
    if (error is CkEditorError) return error;
    return CkEditorError(
      code: error is TimeoutException ? 'command_timeout' : code,
      message: message,
      cause: error,
    );
  }

  @override
  void dispose() {
    if (_state == CkEditorState.disposed) return;
    _endSession(
      const CkEditorError(
        code: 'disposed',
        message: '에디터 Controller가 종료되었습니다.',
      ),
    );
    _state = CkEditorState.disposed;
    super.dispose();
  }
}

class _EditorSession {
  _EditorSession(this.owner, this.execute);

  final Object owner;
  final Future<Object> Function(String) execute;
  final Completer<CkEditorError> ended = Completer<CkEditorError>();
}
