// SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const workspace = path.resolve(process.argv[2]);
const packageRoot = path.join(workspace, 'package');
const ts = require(path.join(packageRoot, 'tool/release/source-build/node_modules/typescript'));
const review = JSON.parse(fs.readFileSync(path.join(packageRoot, 'tool/release/notice-review.json'), 'utf8'));
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

function inside(root, relative) {
  if (path.isAbsolute(relative) || relative.includes('\\') ||
      relative.split('/').some(part => !part || part === '..')) {
    throw new Error(`Unsafe source review path: ${relative}`);
  }
  return path.join(root, relative);
}

const sources = new Map();
for (const entry of review.copiedCodeSourceFiles) {
  if (sources.has(entry.id)) throw new Error('Duplicate reviewed source identifier');
  const directory = inside(path.join(workspace, 'upstream'), entry.upstreamId);
  const data = fs.readFileSync(inside(directory, entry.path));
  if (sha256(data) !== entry.sha256) throw new Error(`Reviewed source checksum differs: ${entry.id}`);
  sources.set(entry.id, data.toString('utf8'));
}

// Compare initializer syntax only: comments, quoting, whitespace, and TS types
// are excluded. Imports and module-level behavior are outside this comparison.
function structure(node) {
  const result = { kind: ts.SyntaxKind[node.kind], children: [] };
  if (typeof node.text === 'string') result.text = node.text;
  if (typeof node.operator === 'number') result.operator = ts.SyntaxKind[node.operator];
  if (ts.isVariableDeclarationList(node)) result.declarationFlags = node.flags & ts.NodeFlags.BlockScoped;
  ts.forEachChild(node, child => { result.children.push(structure(child)); });
  return result;
}

function initializers(id) {
  if (!sources.has(id)) throw new Error(`Missing reviewed source: ${id}`);
  const compiled = ts.transpileModule(sources.get(id), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext },
    fileName: `${id}.ts`, reportDiagnostics: true
  });
  if ((compiled.diagnostics || []).some(d => d.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`Source comparison transpilation failed: ${id}`);
  }
  const source = ts.createSourceFile(`${id}.js`, compiled.outputText,
    ts.ScriptTarget.ES2020, true, ts.ScriptKind.JS);
  const result = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
      const name = declaration.name.text;
      if (result.has(name)) throw new Error(`Duplicate initializer: ${id}/${name}`);
      result.set(name, JSON.stringify(structure(declaration.initializer)));
    }
  }
  return result;
}

const comparisons = review.copiedCodeComparisons.map(entry => {
  if (entry.kind !== 'transpiled-initializer-structure') throw new Error('Unknown source comparison');
  const left = initializers(entry.left);
  const right = initializers(entry.right);
  const matched = entry.names.map(name => {
    if (!left.has(name) || left.get(name) !== right.get(name)) {
      throw new Error(`Color source initializer differs: ${name}`);
    }
    return { name, structureSha256: sha256(left.get(name)) };
  });
  return { ...entry, matched };
});
const report = {
  status: 'source initializer comparison verified',
  compilerVersion: ts.version, sourceFiles: review.copiedCodeSourceFiles,
  comparisons, scope: 'initializer structure; selected historical copying commit not established'
};
fs.writeFileSync(path.join(workspace, 'COLOR_SOURCE_REVIEW_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ reviewedSourceFiles: sources.size,
  matchedInitializers: comparisons.reduce((sum, entry) => sum + entry.matched.length, 0),
  status: report.status }));
