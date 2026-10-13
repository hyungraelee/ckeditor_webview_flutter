// SPDX-License-Identifier: GPL-2.0-or-later

import 'dart:async';
import 'dart:convert';

import 'package:ckeditor_webview_flutter/ckeditor_webview_flutter.dart';
import 'package:flutter_test/flutter_test.dart';

Matcher errorCode(String code) => isA<CkEditorError>().having(
      (error) => error.code,
      'code',
      code,
    );

Future<void> flushQueue() => Future<void>.delayed(Duration.zero);

void main() {
  late CkEditorController controller;
  late EditorSession session;

  setUp(() {
    controller = CkEditorController();
    session = EditorSession(controller);
  });
  tearDown(() => controller.dispose());

  test('commands issued before attach wait for ready and retain order',
      () async {
    final write = controller.setHtml('<p>Queued</p>');
    final read = controller.getHtml();
    await flushQueue();
    expect(session.commands, isEmpty);

    session.attach();
    await session.initialize();
    await flushQueue();
    expect(controller.state, CkEditorState.loading);
    expect(session.commands, isEmpty);

    session.ready();
    await write;
    expect(await read, '<p>Queued</p>');
    expect(session.commands.map((call) => call.$1), ['setHtml', 'getHtml']);
    expect(controller.cachedHtml, '<p>Queued</p>');
  });

  test('a read cannot overtake a write waiting for a native response',
      () async {
    session.attach();
    session.ready();
    final response = Completer<Object>();
    session.respond = (command, args) => command == 'setHtml'
        ? response.future
        : Future.value(jsonEncode({'ok': true, 'data': session.html}));
    final write = controller.setHtml('<p>Ordered write</p>');
    final read = controller.getHtml();
    await flushQueue();
    expect(session.commands.map((call) => call.$1), ['setHtml']);
    session.html = '<p>Ordered write</p>';
    response.complete(jsonEncode({'ok': true, 'data': null}));
    await write;
    expect(await read, '<p>Ordered write</p>');
    expect(session.commands.map((call) => call.$1), ['setHtml', 'getHtml']);
  });

  test('initial HTML, config, CSS and activation survive JSON transport',
      () async {
    const html = '<p title="quotes">한국어 \\ path\n</script> &amp;</p>';
    const css = '.ck-content::before { content: "한국어 </style> \\"; }\n';
    const config = {
      'fontSize': {
        'options': [12, 16, 'default'],
        'supportAllValues': true
      },
      'placeholder': 'Write "here"\n한국어',
    };
    session.attach(initialHtml: html);
    await session.initialize(config: config, customCss: css);
    expect(session.options!['initialHtml'], html);
    expect(session.options!['config'], config);
    expect(session.options!['customCss'], css);
    expect(session.options!['licenseKey'], 'runtime-key');
    expect(session.options!['toolbarItems'], ['bold', '|', 'sourceEditing']);
    session.ready();
    await controller.setHtml(html);
    expect(session.commands.single.$2, [html]);
    expect(await controller.getHtml(), html);
  });

  for (final quoted in [false, true]) {
    test('reads ${quoted ? 'Android quoted' : 'iOS plain'} JSON responses',
        () async {
      session.quoteResponses = quoted;
      session.attach();
      session.ready();
      session.html = '<p>Latest "data"\n한국어</p>';
      expect(await controller.getHtml(), session.html);
      expect(controller.cachedHtml, session.html);
    });
  }

  test('a failed command reports its error and does not block the queue',
      () async {
    session.attach();
    session.ready();
    session.respond = (command, args) {
      if (command == 'setHtml') {
        return Future.value(jsonEncode({
          'ok': false,
          'error': {'code': 'set_data_failed', 'message': 'Rejected data'},
        }));
      }
      return Future.value(jsonEncode({'ok': true, 'data': '<p>Recovered</p>'}));
    };
    final failed = controller.setHtml('<p>Rejected</p>');
    final recovered = controller.getHtml();
    await expectLater(failed, throwsA(errorCode('set_data_failed')));
    expect(await recovered, '<p>Recovered</p>');
    expect(session.errors.single.code, 'set_data_failed');
    expect(controller.state, CkEditorState.ready);
  });

  for (final reply in ['not JSON', '{"ok":true}', '{"ok":true,"data":7}']) {
    test('rejects malformed HTML response $reply', () async {
      session.attach(initialHtml: '<p>Keep snapshot</p>');
      session.ready();
      session.respond = (_, __) => Future.value(reply);
      await expectLater(
        controller.getHtml(),
        throwsA(errorCode('invalid_bridge_result')),
      );
      expect(controller.cachedHtml, '<p>Keep snapshot</p>');
      expect(controller.state, CkEditorState.ready);
    });
  }

  test('a delayed read cannot replace a newer change snapshot', () async {
    session.attach();
    session.ready();
    final response = Completer<Object>();
    session.respond = (_, __) => response.future;
    final read = controller.getHtml();
    await flushQueue();
    session.event('change', {'html': '<p>New change</p>'});
    response.complete(jsonEncode({'ok': true, 'data': '<p>Earlier read</p>'}));
    expect(await read, '<p>Earlier read</p>');
    expect(controller.cachedHtml, '<p>New change</p>');
  });

  test('detach cancels a pending command and reattach restores the snapshot',
      () async {
    session.attach();
    session.ready();
    session.event('change', {'html': '<p>Restore me</p>'});
    final response = Completer<Object>();
    session.respond = (_, __) => response.future;
    final pending = controller.getHtml();
    final failure = expectLater(pending, throwsA(errorCode('detached')));
    await flushQueue();
    controller.detach(session.owner);
    await failure;

    final replacement = EditorSession(controller)
      ..attach(initialHtml: 'New seed');
    await replacement.initialize();
    expect(replacement.options!['initialHtml'], '<p>Restore me</p>');
    replacement.ready();
    session.event('change', {'html': '<p>Stale session</p>'});
    session.event('error', {'code': 'javascript_error', 'message': 'Stale'});
    response.complete(jsonEncode({'ok': true, 'data': '<p>Late result</p>'}));
    await flushQueue();
    expect(controller.state, CkEditorState.ready);
    expect(controller.cachedHtml, '<p>Restore me</p>');
    expect(replacement.errors, isEmpty);
  });

  test('commands waiting for ready cannot execute in a replacement session',
      () async {
    session.attach();
    final pending = controller.setHtml('<p>Old command</p>');
    final failure = expectLater(pending, throwsA(errorCode('detached')));
    await flushQueue();
    controller.detach(session.owner);
    final replacement = EditorSession(controller)..attach();
    replacement.ready();
    await failure;
    expect(replacement.commands, isEmpty);
  });

  test('disposal cancels pending native work and rejects later API calls',
      () async {
    session.attach();
    session.ready();
    final response = Completer<Object>();
    session.respond = (_, __) => response.future;
    final pending = controller.getHtml();
    final failure = expectLater(pending, throwsA(errorCode('disposed')));
    await flushQueue();
    controller.dispose();
    await failure;
    response.complete(jsonEncode({'ok': true, 'data': '<p>Late result</p>'}));
    await expectLater(controller.getHtml(), throwsA(errorCode('disposed')));
    await expectLater(controller.whenReady, throwsA(errorCode('disposed')));
    expect(session.destroyCalls, 1);
    expect(controller.state, CkEditorState.disposed);
  });

  test('initialization errors release readiness and queued commands', () async {
    session.attach();
    final readyFailure = expectLater(
        controller.whenReady, throwsA(errorCode('plugins_missing')));
    final commandFailure = expectLater(
        controller.getHtml(), throwsA(errorCode('plugins_missing')));
    session.event(
        'error', {'code': 'plugins_missing', 'message': 'Missing plugin'});
    await Future.wait([readyFailure, commandFailure]);
    expect(controller.state, CkEditorState.error);
    expect(session.errors.single.code, 'plugins_missing');
    expect(session.commands, isEmpty);
  });

  test('fatal errors cancel native work and queued commands only once',
      () async {
    session.attach();
    session.ready();
    final response = Completer<Object>();
    session.respond = (_, __) => response.future;
    final read = expectLater(
        controller.getHtml(), throwsA(errorCode('javascript_error')));
    final write = expectLater(
        controller.setHtml('pending'), throwsA(errorCode('javascript_error')));
    await flushQueue();
    session.event('error', {'code': 'javascript_error', 'message': 'Failed'});
    await Future.wait([read, write]);
    response.completeError(StateError('Late native error'));
    await flushQueue();
    expect(controller.state, CkEditorState.error);
    expect(session.errors.single.code, 'javascript_error');
    expect(session.commands.map((command) => command.$1), ['getHtml']);
  });

  test('completed commands do not become failures when a session ends',
      () async {
    session.attach();
    session.ready();
    for (var index = 0; index < 100; index++) {
      expect(await controller.getHtml(), '<p>Seed</p>');
    }
    controller.detach(session.owner);
    await flushQueue();
    expect(session.errors, isEmpty);
    expect(controller.cachedHtml, '<p>Seed</p>');
    expect(session.destroyCalls, 1);
  });

  test('invalid config fails before crossing the native execution boundary',
      () async {
    final cycle = <String, Object?>{};
    cycle['loop'] = cycle;
    final invalidValues = <Object?>[
      double.nan,
      double.infinity,
      DateTime(2026),
      () {},
      {1: 'non-string key'},
      {'constructor.prototype': true},
      {'__proto__': true},
      cycle,
    ];
    for (final value in invalidValues) {
      final local = CkEditorController();
      final localSession = EditorSession(local)..attach();
      try {
        await localSession.initialize(config: {'fontSize': value});
        expect(local.state, CkEditorState.error);
        expect(localSession.errors.single.code, 'invalid_editor_config');
        expect(localSession.options, isNull);
      } finally {
        local.dispose();
      }
    }
  });

  testWidgets('ready timeout releases waiters and reports a fatal error',
      (tester) async {
    final local =
        CkEditorController(readyTimeout: const Duration(milliseconds: 50));
    final localSession = EditorSession(local)..attach();
    final readyFailure =
        expectLater(local.whenReady, throwsA(errorCode('ready_timeout')));
    final commandFailure =
        expectLater(local.getHtml(), throwsA(errorCode('ready_timeout')));
    await tester.pump(const Duration(milliseconds: 51));
    await Future.wait([readyFailure, commandFailure]);
    expect(local.state, CkEditorState.error);
    expect(localSession.errors.first.code, 'ready_timeout');
    local.dispose();
  });

  testWidgets('command timeout allows subsequent commands to recover',
      (tester) async {
    final local =
        CkEditorController(commandTimeout: const Duration(milliseconds: 50));
    final localSession = EditorSession(local)..attach();
    localSession.ready();
    final response = Completer<Object>();
    localSession.respond = (_, __) => response.future;
    final failure =
        expectLater(local.getHtml(), throwsA(errorCode('command_timeout')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 51));
    await failure;
    expect(local.state, CkEditorState.ready);
    localSession.respond = null;
    final recovered = local.getHtml();
    await tester.pump();
    expect(await recovered, '<p>Seed</p>');
    response.complete(jsonEncode({'ok': true, 'data': '<p>Too late</p>'}));
    await tester.pump();
    expect(local.cachedHtml, '<p>Seed</p>');
    local.dispose();
  });
}

/// A transport fake only: no CKEditor model or native WebView is emulated.
class EditorSession {
  EditorSession(this.controller);

  final CkEditorController controller;
  final owner = Object();
  final commands = <(String, List<Object?>)>[];
  final errors = <CkEditorError>[];
  Map<String, dynamic>? options;
  String html = '';
  int destroyCalls = 0;
  bool quoteResponses = false;
  Future<Object> Function(String, List<Object?>)? respond;

  void attach({String initialHtml = '<p>Seed</p>'}) {
    html = initialHtml;
    controller.attach(
      owner: owner,
      execute: execute,
      initialHtml: initialHtml,
      onError: errors.add,
    );
  }

  Future<void> initialize({Map<String, Object?>? config, String? customCss}) =>
      controller.initialize(
        owner,
        readOnly: false,
        changeDebounce: const Duration(milliseconds: 300),
        autoHeight: false,
        minHeight: 300,
        toolbarItems: const ['bold', '|', 'sourceEditing'],
        config: config,
        customCss: customCss,
        licenseKey: 'runtime-key',
      );

  void ready() => event('ready');

  void event(String type, [Object? data]) =>
      controller.handleMessage(owner, jsonEncode({'type': type, 'data': data}));

  Future<Object> execute(String script) async {
    const initPrefix = 'void window.ckBridge.initialize(';
    final start = script.indexOf(initPrefix);
    if (start != -1) {
      final end = script.lastIndexOf('); return true;');
      options = jsonDecode(script.substring(start + initPrefix.length, end))
          as Map<String, dynamic>;
      html = options!['initialHtml'] as String;
      return true;
    }
    if (script.contains('window.ckBridge.destroy()')) {
      destroyCalls++;
      return true;
    }
    const prefix = 'window.ckBridge.invoke(';
    if (!script.startsWith(prefix) || !script.endsWith(')')) {
      throw StateError('Unexpected transport script: $script');
    }
    final arguments =
        jsonDecode('[${script.substring(prefix.length, script.length - 1)}]')
            as List<dynamic>;
    final command = arguments[0] as String;
    final args = (arguments[1] as List).cast<Object?>();
    commands.add((command, args));
    if (respond != null) return respond!(command, args);
    if (command == 'setHtml') html = args.single as String;
    final envelope =
        jsonEncode({'ok': true, 'data': command == 'getHtml' ? html : null});
    return quoteResponses ? jsonEncode(envelope) : envelope;
  }
}
