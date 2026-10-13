// SPDX-License-Identifier: GPL-2.0-or-later
// Regenerate selected CLI inputs without executing the reviewed application code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function inside(root, name) {
  if (!name || path.isAbsolute(name) || name.includes('\\') ||
      name.split('/').some((part) => !part || part === '.' || part === '..')) {
    throw new Error(`Unsafe build-tool review path: ${name}`);
  }
  return path.join(root, ...name.split('/'));
}

function digest(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

const work = path.resolve(process.argv[2]);
const packageRoot = path.join(work, 'package');
const review = JSON.parse(fs.readFileSync(
  inside(packageRoot, 'tool/release/build-tool-review.json'), 'utf8'));
if (review.schemaVersion !== 1) throw new Error('Unsupported build-tool review version');
const recipe = review.cliGeneration;
const ts = require(inside(packageRoot,
  `tool/release/source-build/node_modules/${recipe.compilerPackage}/lib/typescript.js`));
if (ts.version !== recipe.compilerVersion) throw new Error('Unexpected CLI compiler version');
const sourceRoot = inside(path.join(work, 'upstream'), recipe.upstreamId);
const config = JSON.parse(fs.readFileSync(inside(sourceRoot, recipe.configPath), 'utf8'));
const converted = ts.convertCompilerOptionsFromJson(config.compilerOptions, sourceRoot);
if (converted.errors.length) throw new Error('Invalid upstream CLI compiler options');
const manifest = JSON.parse(fs.readFileSync(path.join(work, 'SOURCE_MANIFEST.json'), 'utf8'));
const install = manifest.installations.find((item) => item.recipe === 'tool/ckeditor_build');
if (!install) throw new Error('Bundled build installation is absent');
const results = [];
const seen = new Set();
for (const entry of recipe.files) {
  if (seen.has(entry.source)) throw new Error('Duplicate CLI source comparison');
  seen.add(entry.source);
  const locked = install.packages.filter((item) => item.url === entry.npmUrl);
  if (locked.length !== 1 || !entry.npmPath.startsWith('package/')) {
    throw new Error('Ambiguous CLI publication input');
  }
  const source = inside(sourceRoot, entry.source);
  const target = inside(inside(packageRoot, install.recipe),
    `${locked[0].location}/${entry.npmPath.slice('package/'.length)}`);
  const input = fs.readFileSync(source, 'utf8');
  const output = ts.transpileModule(input, {
    fileName: source, compilerOptions: converted.options, reportDiagnostics: true,
  });
  if (output.diagnostics.some((item) => item.category === ts.DiagnosticCategory.Error)) {
    throw new Error(`CLI transpilation failed: ${entry.source}`);
  }
  const generated = Buffer.from(output.outputText);
  if (!generated.equals(fs.readFileSync(target))) {
    throw new Error(`Generated CLI input differs: ${entry.source}`);
  }
  // Use the byte-identical source-generated file in the ensuing bundle build.
  fs.writeFileSync(target, generated);
  results.push({ ...entry, sourceSha256: digest(input), generatedSha256: digest(generated) });
}
const report = {
  status: 'selected CLI generation verified; compiler bootstrap and full toolchain review pending',
  compilerVersion: ts.version,
  scope: 'JavaScript inputs only; declarations, type checking, and historical release reproduction excluded',
  matchedFiles: results,
};
fs.writeFileSync(path.join(work, 'BUILD_TOOL_SOURCE_REPORT.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`Verified ${results.length} source-generated webpack CLI inputs.`);
