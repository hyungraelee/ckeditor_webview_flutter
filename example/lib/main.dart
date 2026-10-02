// SPDX-License-Identifier: GPL-2.0-or-later

import 'package:ckeditor_webview_flutter/ckeditor_webview_flutter.dart';
import 'package:flutter/material.dart';

import 'sample_html.dart';

void main() {
  runApp(const EditorExampleApp());
}

class EditorExampleApp extends StatelessWidget {
  const EditorExampleApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CKEditor 예제',
      theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
      home: const ExampleHome(),
    );
  }
}

class ExampleHome extends StatelessWidget {
  const ExampleHome({super.key});

  void _openEditor(BuildContext context, {required bool autoHeight}) {
    Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => EditorPage(autoHeight: autoHeight)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CKEditor 예제')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Text('높이 방식을 선택하여 에디터를 열어보세요.'),
            const SizedBox(height: 16),
            Card(
              child: ListTile(
                title: const Text('고정 높이'),
                subtitle: const Text('에디터 내부에서 긴 문서를 스크롤합니다.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openEditor(context, autoHeight: false),
              ),
            ),
            Card(
              child: ListTile(
                title: const Text('자동 높이'),
                subtitle: const Text('문서 길이에 따라 늘어나고 페이지가 스크롤됩니다.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openEditor(context, autoHeight: true),
              ),
            ),
            const SizedBox(height: 16),
            const Text(
              '각 화면은 샘플 HTML로 시작합니다. 뒤로 나갔다 다시 열면 '
              '새 에디터가 생성되며 편집 내용은 저장되지 않습니다.',
            ),
          ],
        ),
      ),
    );
  }
}

class EditorPage extends StatefulWidget {
  const EditorPage({super.key, required this.autoHeight});

  final bool autoHeight;

  @override
  State<EditorPage> createState() => _EditorPageState();
}

class _EditorPageState extends State<EditorPage> {
  final _controller = CkEditorController();
  final _htmlInput = TextEditingController(text: sampleHtml);
  bool _readOnly = false;
  bool _busy = false;
  int _changeCount = 0;
  String _message = '에디터를 준비하고 있습니다.';

  @override
  void initState() {
    super.initState();
    _controller.addListener(_onControllerChanged);
  }

  void _onControllerChanged() {
    // Initialization can notify while the child editor is being built.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) setState(() {});
    });
    WidgetsBinding.instance.ensureVisualUpdate();
  }

  Future<void> _runCommand(Future<void> Function() command) async {
    setState(() => _busy = true);
    try {
      await command();
    } catch (error) {
      if (mounted) setState(() => _message = '명령 실패: $error');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _loadHtml(String html) async {
    await _controller.setHtml(html);
    if (!mounted) return;
    setState(() {
      _htmlInput.text = html;
      _message = 'HTML을 불러왔습니다.';
    });
  }

  Future<void> _getHtml() async {
    // Read at save time; cachedHtml is only a recovery snapshot.
    final html = await _controller.getHtml();
    if (!mounted) return;
    setState(() {
      _htmlInput.text = html;
      _message = '현재 HTML을 아래 입력란에 가져왔습니다.';
    });
  }

  @override
  void dispose() {
    _controller.removeListener(_onControllerChanged);
    _controller.dispose();
    _htmlInput.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canRun = _controller.state == CkEditorState.ready && !_busy;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.autoHeight ? '자동 높이 에디터' : '고정 높이 에디터'),
      ),
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: const Text('읽기 전용'),
                value: _readOnly,
                onChanged: canRun
                    ? (value) => setState(() => _readOnly = value)
                    : null,
              ),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  FilledButton.icon(
                    onPressed: canRun ? () => _runCommand(_getHtml) : null,
                    icon: const Icon(Icons.code),
                    label: const Text('HTML 가져오기'),
                  ),
                  OutlinedButton(
                    onPressed: canRun
                        ? () => _runCommand(() => _loadHtml(sampleHtml))
                        : null,
                    child: const Text('샘플 불러오기'),
                  ),
                  OutlinedButton(
                    onPressed: canRun
                        ? () => _runCommand(() => _loadHtml(longSampleHtml))
                        : null,
                    child: const Text('긴 문서 불러오기'),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text('상태: ${_controller.state.name} · 변경 이벤트: $_changeCount'),
              Text(_message),
              const SizedBox(height: 16),
              CkEditorWebView(
                controller: _controller,
                initialHtml: sampleHtml,
                readOnly: _readOnly,
                height: widget.autoHeight ? null : 360,
                autoHeight: widget.autoHeight,
                minHeight: 360,
                onReady: () {
                  if (mounted) {
                    _message = '에디터가 준비되었습니다.';
                    _onControllerChanged();
                  }
                },
                onChanged: (_) {
                  if (mounted) setState(() => _changeCount++);
                },
                onError: (error) {
                  if (mounted) {
                    _message = '에디터 오류: $error';
                    _onControllerChanged();
                  }
                },
              ),
              const SizedBox(height: 24),
              Text(
                'HTML 입력 및 결과',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _htmlInput,
                enabled: !_busy,
                minLines: 4,
                maxLines: 8,
                autocorrect: false,
                enableSuggestions: false,
                style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                decoration: const InputDecoration(
                  border: OutlineInputBorder(),
                  hintText: '<p>불러올 HTML을 입력하세요.</p>',
                ),
              ),
              const SizedBox(height: 8),
              OutlinedButton.icon(
                onPressed: canRun
                    ? () => _runCommand(() => _loadHtml(_htmlInput.text))
                    : null,
                icon: const Icon(Icons.upload),
                label: const Text('입력한 HTML 불러오기'),
              ),
              const Text(
                '편집 후 HTML 가져오기를 누르면 현재 문서가 이 입력란에 '
                '표시됩니다. 지원하지 않는 태그나 속성은 제거될 수 있습니다.',
              ),
            ],
          ),
        ),
      ),
    );
  }
}
