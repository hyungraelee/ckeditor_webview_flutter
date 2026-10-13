// SPDX-License-Identifier: GPL-2.0-or-later

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:yaml/yaml.dart';

import '../bin/src/ckeditor_setup.dart';

void main() {
  late Directory previous;
  late Directory app;
  const pubspec = '''
name: consuming_app
dependencies:
  flutter:
    sdk: flutter
  ckeditor_webview_flutter: ^0.1.0
# Keep this application comment.
flutter:
  uses-material-design: true
  assets:
    - assets/existing.txt
''';

  setUp(() {
    previous = Directory.current;
    app = Directory.systemTemp.createTempSync('ckeditor-setup-test-');
    Directory.current = app;
    File('pubspec.yaml').writeAsStringSync(pubspec);
  });
  tearDown(() {
    Directory.current = previous;
    app.deleteSync(recursive: true);
  });

  test('init preserves unrelated YAML and is idempotent', () {
    initializeEditor(['--version', '^42.0.0']);
    final first = File('pubspec.yaml').readAsStringSync();
    final document = loadYaml(first) as YamlMap;
    expect(first, contains('# Keep this application comment.'));
    expect(document['flutter']['uses-material-design'], true);
    expect(document['flutter']['assets'][0], 'assets/existing.txt');
    expect(document['flutter']['assets'][1]['path'], 'assets/ckeditor.html');
    expect(document['ckeditor_webview_flutter']['editor_version'], '^42.0.0');
    expect(File('assets/ckeditor.html').readAsStringSync(),
        '<!-- ckeditor_webview_flutter:generated -->\n');
    initializeEditor(['--version=^42.0.0']);
    expect(File('pubspec.yaml').readAsStringSync(), first);
  });

  test('init updates the version without duplicating an existing asset', () {
    initializeEditor(['--version', '41.4.1']);
    initializeEditor(['--version', '44.x']);
    final document = loadYaml(File('pubspec.yaml').readAsStringSync());
    expect(document['ckeditor_webview_flutter']['editor_version'], '44.x');
    expect(document['flutter']['assets'], hasLength(2));
  });

  test('existing user HTML is preserved on setup failure', () {
    Directory('assets').createSync();
    File('assets/ckeditor.html').writeAsStringSync('<p>User content</p>');
    expect(
        () => initializeEditor(['--version', '42.0.0']), throwsFormatException);
    expect(
        File('assets/ckeditor.html').readAsStringSync(), '<p>User content</p>');
    expect(File('pubspec.yaml').readAsStringSync(), pubspec);
  });

  test('conflicting transformers fail before creating an asset', () {
    final source = pubspec.replaceFirst('    - assets/existing.txt', '''
    - path: assets/ckeditor.html
      transformers:
        - package: another_transformer''');
    File('pubspec.yaml').writeAsStringSync(source);
    expect(
        () => initializeEditor(['--version', '42.0.0']), throwsFormatException);
    expect(File('assets/ckeditor.html').existsSync(), false);
    expect(File('pubspec.yaml').readAsStringSync(), source);
  });

  test('invalid versions and asset paths leave the project unchanged', () {
    for (final arguments in [
      ['--version', 'latest'],
      ['--version', '42.0.0', '--asset', '../editor.html'],
      ['--version', '42.0.0', '--asset', '/editor.html'],
      ['--version', '42.0.0', '--asset', 'assets//editor.html'],
    ]) {
      expect(() => initializeEditor(arguments), throwsFormatException);
      expect(File('pubspec.yaml').readAsStringSync(), pubspec);
      expect(Directory('assets').existsSync(), false);
    }
  });
}
