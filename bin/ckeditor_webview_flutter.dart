// SPDX-License-Identifier: GPL-2.0-or-later

import 'dart:io';
import 'dart:isolate';

import 'package:yaml/yaml.dart';

import 'src/ckeditor_setup.dart';

/// Flutter asset-transformer entry point; it is not imported by the widget.
Future<void> main(List<String> arguments) async {
  try {
    if (arguments.isNotEmpty && arguments.first == 'init') {
      initializeEditor(arguments.skip(1).toList());
      return;
    }
    // Flutter uses --input=<path>/--output=<path>; also accept split CLI options.
    final values = arguments.expand((argument) {
      for (final name in ['--input', '--output']) {
        if (argument.startsWith('$name=')) {
          return [name, argument.substring(name.length + 1)];
        }
      }
      return [argument];
    }).toList();
    final options = <String, String>{};
    var update = false;
    for (var i = 0; i < values.length; i++) {
      final argument = values[i];
      if (argument == '--help' || argument == '-h') {
        stdout.writeln('''CKEditor optional asset builder

Initial setup:
  dart run ckeditor_webview_flutter init --version "^42.0.0"
  dart run ckeditor_webview_flutter init --help

The init command generates the HTML input and registers the asset transformer
in pubspec.yaml. Set editorAsset on your widget to use the generated editor.
Flutter supplies --input and --output during flutter run/build.
The default bundled editor needs no Node.

Options:
  --input <path>     Placeholder HTML containing the generated-asset marker.
  --output <path>    Generated self-contained editor HTML.
  --update          Explicitly refresh the npm lock and cached build.
  --help            Show this help.

Without --input/--output, only --update is accepted. After updating, run
flutter clean before rebuilding so Flutter re-runs the asset transformer.
''');
        return;
      }
      if (argument == '--update') {
        update = true;
      } else if ((argument == '--input' || argument == '--output') &&
          i + 1 < values.length &&
          values[i + 1].isNotEmpty &&
          !values[i + 1].startsWith('--')) {
        if (options.containsKey(argument)) {
          throw FormatException('Duplicate option: $argument');
        }
        options[argument] = values[++i];
      } else {
        throw FormatException('Unknown or incomplete option: $argument');
      }
    }
    if (options.isEmpty && !update || options.length == 1) {
      throw const FormatException('Supply --input and --output, or --update.');
    }
    if (options['--input'] case final input?) {
      if (!await File(input).exists() ||
          !(await File(input).readAsString()).contains(
            '<!-- ckeditor_webview_flutter:generated -->',
          )) {
        throw const FormatException(
          'The input must be an HTML placeholder containing '
          '<!-- ckeditor_webview_flutter:generated -->.',
        );
      }
    }
    final pubspec = File('pubspec.yaml');
    if (!await pubspec.exists()) {
      throw const FormatException('Run the builder from the Flutter app root.');
    }
    final document = loadYaml(await pubspec.readAsString());
    final config =
        document is YamlMap ? document['ckeditor_webview_flutter'] : null;
    final version = config is YamlMap ? config['editor_version'] : null;
    if (version is! String || version.isEmpty) {
      throw const FormatException(
        'Set ckeditor_webview_flutter.editor_version in pubspec.yaml.',
      );
    }
    final library = await Isolate.resolvePackageUri(
      Uri.parse(
          'package:ckeditor_webview_flutter/ckeditor_webview_flutter.dart'),
    );
    if (library == null || library.scheme != 'file') {
      throw StateError('Cannot locate the package. Run flutter pub get first.');
    }
    final packageRoot = File.fromUri(library).parent.parent.path;
    final process = await Process.start('node', [
      '$packageRoot/tool/ckeditor_builder/build.cjs',
      Directory.current.path,
      packageRoot,
      version,
      options['--output'] ?? '',
      if (update) '--update',
    ]);
    await Future.wait([
      stdout.addStream(process.stdout),
      stderr.addStream(process.stderr),
    ]);
    exitCode = await process.exitCode;
  } on ProcessException catch (error) {
    stderr.writeln(
      'CKEditor build failed: Node.js/npm must be available on PATH for '
      'opt-in builds. ${error.message}',
    );
    exitCode = 1;
  } catch (error) {
    stderr.writeln('CKEditor build failed: $error');
    exitCode = 1;
  }
}
