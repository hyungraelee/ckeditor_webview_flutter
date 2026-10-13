// SPDX-License-Identifier: GPL-2.0-or-later

import 'package:flutter/foundation.dart';

/// A bridge, initialization, or lifecycle failure reported by the editor.
@immutable
class CkEditorError implements Exception {
  const CkEditorError({required this.code, required this.message, this.cause});

  /// Machine-readable identifier; use this instead of matching [message].
  final String code;

  /// Human-readable diagnostic text. Override the widget's error UI to localize it.
  final String message;

  /// Original failure, when available from the Flutter execution boundary.
  final Object? cause;

  @override
  String toString() => 'CkEditorError($code): $message';
}
