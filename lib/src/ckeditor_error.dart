// SPDX-License-Identifier: GPL-2.0-or-later

import 'package:flutter/foundation.dart';

@immutable
class CkEditorError implements Exception {
  const CkEditorError({required this.code, required this.message, this.cause});

  final String code;
  final String message;
  final Object? cause;

  @override
  String toString() => 'CkEditorError($code): $message';
}
