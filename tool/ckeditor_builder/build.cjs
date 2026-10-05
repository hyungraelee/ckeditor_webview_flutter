// SPDX-License-Identifier: GPL-2.0-or-later

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { createRequire } = require('node:module');

const [projectRoot, packageRoot, request, outputPath, updateFlag] = process.argv.slice(2);
const compilerVersion = '0.25.0';
const cache = path.join(projectRoot || '.', '.dart_tool', 'ckeditor_webview_flutter');
let buildLock;

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function inlineScript(value) { return value.replace(/<\/script/gi, '<\\/script'); }
function isEditorPackage(name) {
  return /(?:^|\/)node_modules\/@ckeditor\/ckeditor5-(?!dev-)[^/]+$/.test(name);
}

// Execute npm's JavaScript CLI through Node; this also avoids .cmd shell quoting
// on Windows and keeps version requests out of shell command strings.
function npmCli() {
  for (const directory of (process.env.PATH || '').split(path.delimiter)) {
    const candidate = path.join(directory, process.platform === 'win32' ? 'npm.cmd' : 'npm');
    if (!fs.existsSync(candidate)) continue;
    const real = fs.realpathSync(candidate);
    const script = process.platform === 'win32'
      ? path.join(path.dirname(real), 'node_modules', 'npm', 'bin', 'npm-cli.js') : real;
    if (fs.existsSync(script)) return script;
  }
  throw new Error('npm is unavailable on PATH. Install Node.js/npm on the developer PC and CI.');
}

function npm(args) {
  const result = spawnSync(process.execPath, [npmCli(), ...args, '--no-audit', '--no-fund'], {
    cwd: cache, stdio: 'inherit'
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`npm ${args[0]} failed (exit ${result.status}).`);
}

function notices(lock) {
  const groups = new Map();
  for (const name of Object.keys(lock.packages)) {
    if (!name.startsWith('node_modules/') || name.split('/').includes('..')) continue;
    const directory = path.join(cache, name);
    if (!fs.existsSync(directory)) continue;
    const info = readJson(path.join(directory, 'package.json'));
    for (const file of fs.readdirSync(directory)) {
      if (!/^(license|copying)(\..*)?$/i.test(file)) continue;
      const license = path.join(directory, file);
      if (!fs.statSync(license).isFile()) continue;
      const text = fs.readFileSync(license, 'utf8');
      const key = hash(text);
      if (!groups.has(key)) groups.set(key, { packages: [], text });
      groups.get(key).packages.push(`${info.name}@${info.version}`);
    }
  }
  return [
    { packages: ['ckeditor_webview_flutter'], text: fs.readFileSync(path.join(packageRoot, 'LICENSE'), 'utf8') },
    ...groups.values()
  ];
}

async function build() {
  if (Number(process.versions.node.split('.')[0]) < 20) {
    throw new Error('Opt-in editor builds require Node.js 20 or newer.');
  }
  if (!/^(?:[~^]?\d+\.\d+\.\d+|\d+\.(?:x|\d+\.x))$/.test(request || '')) {
    throw new Error('Use an exact, caret/tilde, or numeric wildcard version request, '
      + 'such as ^43.0.0 or 44.x. Tags, URLs, and prereleases are not accepted.');
  }
  const requestedMajor = Number(request.match(/\d+/)[0]);
  const modern = requestedMajor >= 42;
  const legacyRecipe = readJson(path.join(packageRoot, 'tool/ckeditor_build/package.json'));
  const buildDependencies = modern ? { esbuild: compilerVersion }
    : { esbuild: compilerVersion, ...legacyRecipe.devDependencies };
  fs.mkdirSync(cache, { recursive: true });
  // Exclusive access prevents simultaneous asset builds from changing the same
  // npm installation or lock. Normal completion releases this lock file.
  const lockPath = path.join(cache, 'build.lock');
  try { buildLock = fs.openSync(lockPath, 'wx'); }
  catch (_) { throw new Error(`Another editor build is active. If an earlier build was killed, remove ${lockPath}.`); }

  const persistentLock = path.join(projectRoot, 'ckeditor_webview_flutter.lock');
  const localLock = path.join(cache, 'package-lock.json');
  const persistLock = () => {
    if (fs.existsSync(persistentLock) &&
        fs.readFileSync(persistentLock).equals(fs.readFileSync(localLock))) return;
    const nextLock = persistentLock + '.tmp';
    fs.copyFileSync(localLock, nextLock);
    fs.renameSync(nextLock, persistentLock);
  };
  const manifest = { name: 'ckeditor-webview-flutter-generated', version: '1.0.0', private: true,
    dependencies: { ckeditor5: request, ...buildDependencies } };
  const updating = updateFlag === '--update';
  let lock;
  if (fs.existsSync(persistentLock)) {
    lock = readJson(persistentLock);
    const previous = lock.packages?.['']?.dependencies;
    if (!updating && (previous?.ckeditor5 !== request ||
        Object.entries(buildDependencies).some(([name, value]) => previous?.[name] !== value))) {
      throw new Error('The editor request or compiler changed. Run '
        + 'dart run ckeditor_webview_flutter --update, then flutter clean and rebuild.');
    }
    fs.copyFileSync(persistentLock, localLock);
  }
  writeJson(path.join(cache, 'package.json'), manifest);
  const modules = path.join(cache, 'node_modules');
  const installed = path.join(modules, 'ckeditor5', 'package.json');
  const lockedVersion = lock?.packages?.['node_modules/ckeditor5']?.version;
  const reusable = lockedVersion && fs.existsSync(installed)
    && readJson(installed).version === lockedVersion
    && Object.entries(buildDependencies).every(([name, value]) => {
      const metadata = path.join(modules, name, 'package.json');
      return fs.existsSync(metadata) && readJson(metadata).version === value;
    });
  if (updating) {
    npm(['install']);
    npm(['update', 'ckeditor5']);
  } else if (!lock) {
    npm(['install']);
  } else if (!reusable) {
    npm(['ci']);
  }
  lock = readJson(localLock);
  const version = lock.packages['node_modules/ckeditor5'].version;
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error(`Unsupported resolved version: ${version}`);
  const major = Number(version.split('.')[0]);
  if (major !== requestedMajor) throw new Error(`Unexpected resolved major: ${version}`);
  for (const [name, info] of Object.entries(lock.packages)) {
    if (isEditorPackage(name) && info.version !== version) {
      throw new Error(`Mixed editor versions: ${name}@${info.version}; expected ${version}.`);
    }
  }
  const dist = path.join(cache, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const editorHtml = path.join(dist, 'editor.html');
  const metadataFile = path.join(dist, 'build-info.json');
  const entry = fs.readFileSync(path.join(packageRoot, modern
    ? 'tool/ckeditor_builder/entry.mjs' : 'tool/ckeditor_build/editor-entry.js'), 'utf8');
  const legacyBuilder = fs.readFileSync(path.join(packageRoot, 'tool/ckeditor_builder/legacy.cjs'), 'utf8');
  const bridge = fs.readFileSync(path.join(packageRoot, 'assets/editor/editor.js'), 'utf8');
  const layoutCss = fs.readFileSync(path.join(packageRoot, 'assets/editor/editor.css'), 'utf8');
  const fingerprint = hash(JSON.stringify([lock, entry, bridge, layoutCss, legacyBuilder,
    fs.readFileSync(__filename, 'utf8'), fs.readFileSync(path.join(packageRoot, 'LICENSE'), 'utf8')]));
  if (!updating && fs.existsSync(metadataFile) && fs.existsSync(editorHtml)) {
    const previous = readJson(metadataFile);
    if (previous.fingerprint === fingerprint && previous.htmlSha256 === hash(fs.readFileSync(editorHtml))) {
      persistLock();
      if (outputPath && path.resolve(outputPath) !== editorHtml) {
        fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
        fs.copyFileSync(editorHtml, outputPath);
      }
      console.log(`CKEditor ${version}: cached local asset reused.`);
      return;
    }
  }
  const entryPath = path.join(cache, modern ? 'entry.mjs' : 'editor-entry.js');
  fs.writeFileSync(entryPath, entry);
  const requireFromCache = createRequire(path.join(cache, 'package.json'));
  if (modern) {
    const esbuild = requireFromCache('esbuild');
    await esbuild.build({ entryPoints: [entryPath], bundle: true, format: 'iife',
      globalName: 'CKEDITOR', target: 'es2020', minify: true, legalComments: 'external',
      outfile: path.join(dist, 'ckeditor.js'), logLevel: 'warning' });
  } else {
    await require('./legacy.cjs')({ requireFromCache, cache, dist, entryPath });
  }
  const javascript = fs.readFileSync(path.join(dist, 'ckeditor.js'), 'utf8');
  const stylesheet = fs.readFileSync(path.join(dist, 'ckeditor.css'), 'utf8');
  const info = { protocol: 2, version, translationFormat: modern ? 'umd' : 'legacy',
    supportsConfig: true, supportsCustomCss: true };
  const thirdPartyNotices = notices(lock);
  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Document editor</title>
<script>${inlineScript(bridge)}</script>
<script>window.CKEDITOR_BUNDLE_INFO=${JSON.stringify(info)};
(() => { const style=document.createElement('style');
style.textContent=${inlineScript(JSON.stringify(stylesheet + '\n' + layoutCss))};
document.head.appendChild(style); })();</script>
<script>${inlineScript(javascript)}</script>
<script type="application/json" id="ckeditor-third-party-notices">${JSON.stringify(thirdPartyNotices).replace(/</g, '\\u003c')}</script>
</head><body><main id="editor-container"><div id="editor"></div></main></body></html>`;
  fs.writeFileSync(editorHtml, html);
  writeJson(path.join(dist, 'THIRD_PARTY_NOTICES.json'), thirdPartyNotices);
  writeJson(metadataFile, { ...info, request, fingerprint, htmlSha256: hash(html),
    packages: Object.fromEntries(Object.entries(lock.packages)
      .filter(([name]) => name === 'node_modules/ckeditor5' || isEditorPackage(name))
      .map(([name, value]) => [name.replace(/^node_modules\//, ''), value.version])) });
  // Persist only a successful resolution/build. A failed update preserves the
  // previously selected application lock and therefore cannot silently switch it.
  persistLock();
  if (outputPath && path.resolve(outputPath) !== editorHtml) {
    fs.mkdirSync(path.dirname(path.resolve(outputPath)), { recursive: true });
    fs.copyFileSync(editorHtml, outputPath);
  }
  console.log(`CKEditor ${version}: local asset built. Commit ckeditor_webview_flutter.lock for reproducible builds.`);
}

build().catch(error => {
  console.error(`CKEditor build failed: ${error.message}`);
  process.exitCode = 1;
}).finally(() => {
  if (buildLock !== undefined) {
    fs.closeSync(buildLock);
    fs.unlinkSync(path.join(cache, 'build.lock'));
  }
});
