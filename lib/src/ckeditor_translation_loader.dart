// SPDX-License-Identifier: GPL-2.0-or-later

import 'dart:convert';
import 'dart:io';

import 'package:flutter/widgets.dart' show Locale;

/// The legacy 41.x translation scripts register window.CKEDITOR_TRANSLATIONS.
/// Keep this version aligned with the locally bundled editor.
const _editorVersion = '41.4.1';
const _translationTimeout = Duration(seconds: 3);

typedef CkEditorTranslation = ({String language, String? script});

Future<CkEditorTranslation> loadCkEditorTranslation(
  Locale locale, {
  String version = _editorVersion,
  bool modern = false,
}) async {
  final language = _translationLanguage(locale);
  const fallback = (language: 'en', script: null);
  if (language == 'en') return fallback;

  final client = HttpClient()..connectionTimeout = _translationTimeout;
  try {
    final script = await (() async {
      final uri = Uri.https(
        'cdn.ckeditor.com',
        modern
            ? '/ckeditor5/$version/translations/$language.umd.js'
            : '/ckeditor5/$version/super-build/translations/$language.js',
      );
      final request = await client.getUrl(uri);
      request.followRedirects = false;
      final response = await request.close();
      if (response.statusCode != HttpStatus.ok) return null;
      final bytes = <int>[];
      await for (final chunk in response) {
        bytes.addAll(chunk);
        if (bytes.length > 256 * 1024) return null;
      }
      final source = utf8.decode(bytes);
      return source.isEmpty ? null : source;
    })()
        .timeout(_translationTimeout);
    return script == null ? fallback : (language: language, script: script);
  } catch (_) {
    // Localization is optional; the local English editor must still start.
    return fallback;
  } finally {
    client.close(force: true);
  }
}

String _translationLanguage(Locale locale) {
  final language = locale.languageCode.toLowerCase();
  final country = locale.countryCode?.toUpperCase();
  if (language == 'zh') {
    return locale.scriptCode == 'Hant' ||
            (locale.scriptCode != 'Hans' &&
                const {'TW', 'HK', 'MO'}.contains(country))
        ? 'zh'
        : 'zh-cn';
  }
  if (language == 'pt' && country == 'BR') return 'pt-br';
  if (language == 'es' && country == 'CO') return 'es-co';
  if (language == 'de' && country == 'CH') return 'de-ch';
  if (language == 'sr' && locale.scriptCode == 'Latn') return 'sr-latn';
  return language;
}
