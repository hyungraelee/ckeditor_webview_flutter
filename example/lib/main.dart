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
      title: 'CKEditor Example',
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
      appBar: AppBar(title: const Text('CKEditor Example')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: ListTile(
                title: const Text('Fixed height'),
                subtitle:
                    const Text('Scroll long documents inside the editor.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openEditor(context, autoHeight: false),
              ),
            ),
            Card(
              child: ListTile(
                title: const Text('Automatic height'),
                subtitle: const Text('The editor grows with the document.'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => _openEditor(context, autoHeight: true),
              ),
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
  static const _customCss = '''
:root {
  --ck-color-toolbar-background: #eef2ff;
  --ck-color-base-border: #a5b4fc;
  --ck-color-focus-border: #4f46e5;
  --ck-color-button-on-background: #c7d2fe;
  --ck-border-radius: 8px;
}
#editor-container .ck-content {
  background: #fffdf7;
  font-family: Georgia, serif;
  font-size: 16px;
  line-height: 1.8;
  padding: 16px 20px;
}
''';

  final _controller = CkEditorController();
  bool _busy = false;
  String? _htmlOutput;

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

  Future<void> _getHtml() async {
    setState(() => _busy = true);
    try {
      // Read the current editor data; cachedHtml is a recovery snapshot.
      final html = await _controller.getHtml();
      if (!mounted) return;
      setState(() => _htmlOutput = html);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to get HTML: $error')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _controller.removeListener(_onControllerChanged);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final canRun = _controller.state == CkEditorState.ready && !_busy;
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.autoHeight ? 'Automatic height' : 'Fixed height'),
      ),
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              CkEditorWebView(
                controller: _controller,
                initialHtml: sampleHtml,
                toolbarItems: widget.autoHeight
                    ? const [
                        'heading',
                        '|',
                        'bold',
                        'italic',
                        'link',
                        '|',
                        'fontFamily',
                        'fontSize',
                        'fontColor',
                        '|',
                        'sourceEditing',
                      ]
                    : null,
                // Fixed height keeps defaults; automatic height shows config.
                config: widget.autoHeight
                    ? const {
                        'link': {'defaultProtocol': 'https://'},
                        'fontFamily': {
                          'options': [
                            'default',
                            'Arial, Helvetica, sans-serif',
                            'Georgia, serif',
                          ],
                          'supportAllValues': true,
                        },
                        'fontSize': {
                          'options': [12, 16, 20, 24, 'default'],
                          'supportAllValues': true,
                        },
                        'fontColor': {
                          'colors': [
                            {'color': '#000000', 'label': 'Black'},
                            {'color': '#D32F2F', 'label': 'Red'},
                            {'color': '#1976D2', 'label': 'Blue'},
                          ],
                          'columns': 3,
                        },
                      }
                    : null,
                customCss: widget.autoHeight ? _customCss : null,
                height: widget.autoHeight ? null : 360,
                autoHeight: widget.autoHeight,
                minHeight: 360,
              ),
              const SizedBox(height: 16),
              Align(
                alignment: Alignment.centerLeft,
                child: FilledButton(
                  onPressed: canRun ? _getHtml : null,
                  child: const Text('Get HTML'),
                ),
              ),
              if (_htmlOutput != null) ...[
                const SizedBox(height: 16),
                Text(
                  'HTML output',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 8),
                SelectableText(
                  _htmlOutput!,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 13),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
