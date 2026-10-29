// SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const workspace = path.resolve(process.argv[2]);
const packageRoot = path.join(workspace, 'package');
const buildRoot = path.join(packageRoot, 'tool/ckeditor_build');
const compilerRoot = path.join(packageRoot, 'tool/release/source-build/node_modules');
const ckCompiler = require(path.join(compilerRoot, 'typescript'));
const vanillaCompiler = require(path.join(compilerRoot, 'typescript-vanilla'));
const ids = JSON.parse(fs.readFileSync(path.join(packageRoot, 'tool/release/bundled-module-identifiers.json'), 'utf8'));
const ckSource = path.join(workspace, 'upstream/ckeditor5');
const vanillaSource = path.join(workspace, 'upstream/vanilla-colorful');
const counts = { ckeditor: 0, vanillaColorful: 0, lodashEs: 0, ckeditorResources: 0 };
const lodashRoot = path.join(packageRoot, 'tool/release/lodash-build/node_modules');
const lodashSource = path.join(workspace, 'upstream/lodash-tag-source/lodash.js');
const lodashInstalled = path.join(lodashRoot, 'lodash/lodash.js');
const lodashGenerated = path.join(workspace, 'generated/lodash-es');

// Supply the preferred modification source to the pinned generator. The
// generator's own manifest pins 4.17.20; this scoped recipe uses 4.17.21.
if (!fs.readFileSync(lodashSource).equals(fs.readFileSync(lodashInstalled))) {
  throw new Error('Lodash development source differs from the pinned npm source');
}
fs.writeFileSync(lodashInstalled, fs.readFileSync(lodashSource));
const lodashBuild = spawnSync(process.execPath, [
  path.join(workspace, 'upstream/lodash-cli-generator/bin/lodash'),
  'modularize', 'exports=es', '-o', lodashGenerated
], { stdio: 'inherit', env: { ...process.env, NODE_PATH: lodashRoot } });
if (lodashBuild.error || lodashBuild.status !== 0) {
  throw lodashBuild.error || new Error('Lodash ES generation failed');
}

function filesIn(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(full) : [full];
  });
}
// Restore original styles/icons/translations too, including theme importer
// inputs not individually represented in the emitted JavaScript module list.
for (const name of fs.readdirSync(path.join(buildRoot, 'node_modules/@ckeditor'))) {
  const installed = path.join(buildRoot, 'node_modules/@ckeditor', name);
  for (const folder of ['theme', 'lang']) {
    const directory = path.join(installed, folder);
    if (!fs.existsSync(directory)) continue;
    for (const destination of filesIn(directory)) {
      if (!/\.(css|svg|po)$/.test(destination)) continue;
      const source = path.join(ckSource, 'packages', name, path.relative(installed, destination));
      const data = fs.readFileSync(source);
      if (!data.equals(fs.readFileSync(destination))) throw new Error(`Upstream resource differs: ${destination}`);
      fs.writeFileSync(destination, data);
      counts.ckeditorResources++;
    }
  }
}

const styles = spawnSync(process.execPath, ['scripts/build-styles.cjs'], {
  cwd: vanillaSource, stdio: 'inherit', env: { ...process.env, NODE_PATH: compilerRoot }
});
if (styles.error || styles.status !== 0) throw styles.error || new Error('Style generation failed');
const ckConfig = ckCompiler.readConfigFile(path.join(ckSource, 'tsconfig.release.json'), ckCompiler.sys.readFile);
if (ckConfig.error) throw new Error('Cannot read upstream TypeScript configuration');
const ckOptions = ckCompiler.parseJsonConfigFileContent(ckConfig.config, ckCompiler.sys, ckSource).options;
const vanillaConfig = vanillaCompiler.readConfigFile(path.join(vanillaSource, 'tsconfig.json'), vanillaCompiler.sys.readFile);
if (vanillaConfig.error) throw new Error('Cannot read vanilla TypeScript configuration');
const vanillaOptions = vanillaCompiler.parseJsonConfigFileContent(vanillaConfig.config, vanillaCompiler.sys, vanillaSource).options;

for (const id of ids) {
  if (!id.endsWith('.js') || !id.startsWith('node_modules/')) continue;
  let source;
  let compiler;
  let options;
  let count;
  const ck = id.match(/^node_modules\/(?:@ckeditor\/)?(ckeditor5[^/]*)\/(.*)\.js$/);
  if (ck) {
    source = path.join(ckSource, ck[1] === 'ckeditor5' ? '' : 'packages/' + ck[1], ck[2] + '.ts');
    compiler = ckCompiler;
    options = ckOptions;
    count = 'ckeditor';
  } else if (id.startsWith('node_modules/vanilla-colorful/')) {
    source = path.join(vanillaSource, 'src', id.slice('node_modules/vanilla-colorful/'.length).replace(/\.js$/, '.ts'));
    compiler = vanillaCompiler;
    options = vanillaOptions;
    count = 'vanillaColorful';
  } else if (id.startsWith('node_modules/lodash-es/')) {
    const relative = id.slice('node_modules/lodash-es/'.length);
    source = path.join(lodashGenerated, relative);
    const data = fs.readFileSync(source);
    const destination = path.join(buildRoot, id);
    if (!data.equals(fs.readFileSync(path.join(workspace, 'upstream/lodash-es', relative))) ||
        !data.equals(fs.readFileSync(destination))) {
      throw new Error(`Regenerated ES module differs: ${id}`);
    }
    fs.writeFileSync(destination, data);
    counts.lodashEs++;
    continue;
  } else continue;
  // Regenerate JavaScript with upstream compiler options; this does not perform
  // type checking or claim reproduction of the complete upstream npm release.
  const result = compiler.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: options, fileName: path.basename(source), reportDiagnostics: true
  });
  if ((result.diagnostics || []).some(d => d.category === compiler.DiagnosticCategory.Error)) {
    throw new Error(`TypeScript generation failed: ${id}`);
  }
  const destination = path.join(buildRoot, id);
  if (result.outputText !== fs.readFileSync(destination, 'utf8')) {
    throw new Error(`Regenerated JavaScript differs: ${id}`);
  }
  fs.writeFileSync(destination, result.outputText);
  counts[count]++;
}
if (counts.ckeditor !== 452 || counts.vanillaColorful !== 12 || counts.lodashEs !== 191) {
  throw new Error('Source coverage differs from the audited bundle; repeat the inventory audit');
}
// Report the rest of the publication too, without claiming a full npm rebuild.
const published = fs.readdirSync(path.join(workspace, 'upstream/lodash-es'))
  .filter(name => name.endsWith('.js')).sort();
const unmatched = published.filter(name => {
  const generated = path.join(lodashGenerated, name);
  return !fs.existsSync(generated) || !fs.readFileSync(generated).equals(
    fs.readFileSync(path.join(workspace, 'upstream/lodash-es', name)));
});
fs.writeFileSync(path.join(workspace, 'LODASH_GENERATION_REPORT.json'), JSON.stringify({
  source: 'lodash-tag-source/lodash.js', generator: 'lodash-cli-generator/bin/lodash',
  installedVersion: require(path.join(lodashRoot, 'lodash/package.json')).version,
  generatedModules: fs.readdirSync(lodashGenerated).filter(name => name.endsWith('.js')).length,
  auditedMatchedModules: counts.lodashEs, publishedModules: published.length,
  unmatchedPublicationModules: unmatched,
  scope: 'audited bundle inputs; complete historical npm release not reproduced'
}, null, 2) + '\n');
fs.writeFileSync(path.join(workspace, 'SOURCE_GENERATION_REPORT.json'), JSON.stringify(counts, null, 2) + '\n');
console.log(JSON.stringify(counts));
