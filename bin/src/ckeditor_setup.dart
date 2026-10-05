// SPDX-License-Identifier: GPL-2.0-or-later

import 'dart:io';

import 'package:yaml/yaml.dart';
import 'package:yaml_edit/yaml_edit.dart';

const _package = 'ckeditor_webview_flutter';
const _marker = '<!-- ckeditor_webview_flutter:generated -->';

/// Register an application-owned transformer input without invoking Node/npm.
void initializeEditor(List<String> arguments) {
  if (arguments.contains('--help') || arguments.contains('-h')) {
    stdout.writeln('''CKEditor optional editor setup

Usage:
  dart run ckeditor_webview_flutter init --version "^42.0.0"

Options:
  --version <request>  Required 42.x request, e.g. 42.0.0, ^42.0.0, or 42.x.
  --asset <path>       Relative HTML asset key (default: assets/ckeditor.html).
  --help              Show this help.

Run from the consuming Flutter app root after adding this package and running
flutter pub get. This command preserves unrelated pubspec settings/comments,
creates the transformer input, and prints the required widget configuration.
It does not overwrite user HTML, modify Dart files, or invoke Node/npm.
''');
    return;
  }
  final options = <String, String>{};
  for (var index = 0; index < arguments.length; index++) {
    final argument = arguments[index];
    final separator = argument.indexOf('=');
    final name = separator < 0 ? argument : argument.substring(0, separator);
    if (name != '--version' && name != '--asset') {
      throw FormatException('Unknown setup option: $argument');
    }
    final String value;
    if (separator >= 0) {
      value = argument.substring(separator + 1);
    } else if (index + 1 < arguments.length &&
        !arguments[index + 1].startsWith('--')) {
      value = arguments[++index];
    } else {
      throw FormatException('Missing value for $name.');
    }
    if (value.isEmpty || options.containsKey(name)) {
      throw FormatException('Empty or duplicate setup option: $name');
    }
    options[name] = value;
  }
  final version = options['--version'];
  if (version == null ||
      !RegExp(r'^(?:[~^]?42\.\d+\.\d+|42\.(?:x|\d+\.x))$').hasMatch(version)) {
    throw const FormatException(
      'Supply --version with a supported 42.x request, such as "^42.0.0".',
    );
  }
  final asset = options['--asset'] ?? 'assets/ckeditor.html';
  final parts = asset.split('/');
  if (!RegExp(r'^[A-Za-z0-9_./-]+\.html$').hasMatch(asset) ||
      parts.any((part) => part.isEmpty || part == '.' || part == '..')) {
    throw const FormatException(
      'Use a relative HTML asset key without traversal or URL components.',
    );
  }
  var current = Directory.current.path;
  for (var index = 0; index < parts.length; index++) {
    current = '$current/${parts[index]}';
    final type = FileSystemEntity.typeSync(current, followLinks: false);
    final expected = index == parts.length - 1
        ? FileSystemEntityType.file
        : FileSystemEntityType.directory;
    if (type != FileSystemEntityType.notFound && type != expected) {
      throw FormatException('Asset path contains a conflicting entry: $asset');
    }
  }
  final input = File(asset);
  if (input.existsSync() && input.readAsStringSync().trim() != _marker) {
    throw FormatException(
      'Refusing to overwrite existing HTML at $asset. Choose another --asset.',
    );
  }
  final pubspec = File('pubspec.yaml');
  if (!pubspec.existsSync()) {
    throw const FormatException(
        'Run init from the consuming Flutter app root.');
  }
  final source = pubspec.readAsStringSync();
  final document = loadYaml(source);
  if (document is! YamlMap ||
      document['dependencies'] is! YamlMap ||
      !(document['dependencies'] as YamlMap).containsKey(_package)) {
    throw const FormatException(
      'Add ckeditor_webview_flutter as an application dependency and run '
      'flutter pub get before initialization.',
    );
  }
  final dependencies = document['dependencies'] as YamlMap;
  if (dependencies['flutter'] is! YamlMap ||
      (dependencies['flutter'] as YamlMap)['sdk'] != 'flutter') {
    throw const FormatException('The consuming project must be a Flutter app.');
  }
  final config = document[_package];
  final flutter = document['flutter'];
  if (config != null && config is! YamlMap ||
      flutter != null && flutter is! YamlMap) {
    throw const FormatException(
      'The ckeditor_webview_flutter and flutter sections must be YAML maps.',
    );
  }
  final assets = flutter is YamlMap ? flutter['assets'] : null;
  if (assets != null && assets is! YamlList) {
    throw const FormatException('flutter.assets must be a YAML list.');
  }
  final matches = <int>[];
  if (assets is YamlList) {
    for (var index = 0; index < assets.length; index++) {
      final entry = assets[index];
      if (entry == asset || entry is YamlMap && entry['path'] == asset) {
        matches.add(index);
        if (entry is YamlMap) {
          if (entry.keys.any((key) => key != 'path' && key != 'transformers')) {
            throw FormatException(
              'Asset $asset has additional restrictions. Choose another --asset.',
            );
          }
          final transformers = entry['transformers'];
          if (transformers != null &&
              !(transformers is YamlList &&
                  (transformers.isEmpty ||
                      transformers.length == 1 &&
                          transformers.first is YamlMap &&
                          (transformers.first as YamlMap).length == 1 &&
                          (transformers.first as YamlMap)['package'] ==
                              _package))) {
            throw FormatException(
              'Asset $asset has a conflicting transformer. Choose another --asset.',
            );
          }
        }
      }
    }
  }
  if (matches.length > 1) {
    throw FormatException('Asset $asset is registered more than once.');
  }

  // Complete all validation and construct the YAML before changing any files.
  final editor = YamlEditor(source);
  if (config is! YamlMap) {
    editor.update([_package], {'editor_version': version});
  } else if (config['editor_version'] != version) {
    editor.update([_package, 'editor_version'], version);
  }
  if (flutter is! YamlMap) editor.update(['flutter'], <String, Object>{});
  final registration = {
    'path': asset,
    'transformers': [
      {'package': _package},
    ],
  };
  if (assets is! YamlList) {
    editor.update(['flutter', 'assets'], [registration]);
  } else if (matches.isEmpty) {
    editor.appendToList(['flutter', 'assets'], registration);
  } else {
    final index = matches.single;
    final entry = assets[index];
    if (entry is! YamlMap) {
      editor.update(['flutter', 'assets', index], registration);
    } else if (entry['transformers'] == null ||
        (entry['transformers'] as YamlList).isEmpty) {
      editor.update(
        ['flutter', 'assets', index, 'transformers'],
        registration['transformers'],
      );
    }
  }
  final result = editor.toString();
  final created = !input.existsSync();
  if (created) {
    input.parent.createSync(recursive: true);
    input.writeAsStringSync('$_marker\n');
  }
  try {
    if (result != source) pubspec.writeAsStringSync(result);
  } catch (_) {
    if (created) input.deleteSync();
    rethrow;
  }
  stdout.writeln('''Editor setup complete: $asset ($version).

Use this option on each widget that should load the generated editor:
  CkEditorWebView(controller: controller, editorAsset: '$asset')

Run flutter pub get, then flutter run/build. Node.js 20+ and npm are required
when building this asset, not during init or on the mobile device.
Widgets without editorAsset continue to use the bundled CKEditor 41.4.1.
Commit pubspec.yaml and $asset. After a successful build, also commit
ckeditor_webview_flutter.lock. If a lock already exists and the version request
changed, run dart run ckeditor_webview_flutter --update, then flutter clean.
''');
}
