// SPDX-License-Identifier: GPL-2.0-or-later

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const packageRoot = path.resolve(__dirname, '..');

// Exercise the real builder with local npm/compiler fixtures. These tests do
// not install dependencies, access the network, or compile a real editor.
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ckeditor-builder-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const cache = path.join(root, '.dart_tool/ckeditor_webview_flutter');
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.mkdirSync(cache, { recursive: true });
  const lock = {
    lockfileVersion: 3,
    packages: {
      '': { dependencies: { ckeditor5: '42.0.0', esbuild: '0.25.0' } },
      'node_modules/ckeditor5': { version: '42.0.0' },
      'node_modules/esbuild': { version: '0.25.0' },
      'node_modules/transitive': { version: '1.0.0' }
    }
  };
  const lockPath = path.join(root, 'ckeditor_webview_flutter.lock');
  const saveLock = () => fs.writeFileSync(lockPath, JSON.stringify(lock));
  saveLock();
  const npmScript = `
const fs = require('node:fs');
const path = require('node:path');
fs.appendFileSync('npm-calls.txt', process.argv[2] + '\\n');
if (fs.existsSync('fail-install')) process.exit(1);
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
fs.rmSync('node_modules', { recursive: true, force: true });
for (const [location, info] of Object.entries(lock.packages)) {
  if (!location) continue;
  fs.mkdirSync(location, { recursive: true });
  fs.writeFileSync(path.join(location, 'package.json'), JSON.stringify({
    name: location.slice('node_modules/'.length), version: info.version
  }));
  fs.writeFileSync(path.join(location, 'LICENSE'), 'Fixture package license');
}
fs.writeFileSync('node_modules/esbuild/index.js', ${JSON.stringify(`
const fs = require('node:fs');
const path = require('node:path');
exports.build = async ({ outfile }) => {
  if (fs.existsSync('fail-build')) throw new Error('Fixture build failed');
  const dependency = require('../transitive/package.json').version;
  fs.writeFileSync(outfile, 'window.fixtureDependency=' + JSON.stringify(dependency) + ';');
  fs.writeFileSync(path.join(path.dirname(outfile), 'ckeditor.css'), '.fixture {}');
  fs.writeFileSync(outfile + '.LEGAL.txt', 'Fixture extracted copyright notice');
};
`)});
`;
  if (process.platform === 'win32') {
    fs.writeFileSync(path.join(bin, 'npm.cmd'), 'fixture');
    fs.mkdirSync(path.join(bin, 'node_modules/npm/bin'), { recursive: true });
    fs.writeFileSync(path.join(bin, 'node_modules/npm/bin/npm-cli.js'), npmScript);
  } else {
    fs.writeFileSync(path.join(bin, 'npm'), npmScript);
  }
  return {
    cache, lock, saveLock,
    run() {
      return spawnSync(process.execPath, [path.join(packageRoot, 'tool/ckeditor_builder/build.cjs'),
        root, packageRoot, '42.0.0', path.join(root, 'editor.html')], {
        cwd: cache, encoding: 'utf8', env: { ...process.env, PATH: bin }
      });
    },
    html: () => fs.readFileSync(path.join(root, 'editor.html'), 'utf8'),
    calls: () => fs.readFileSync(path.join(cache, 'npm-calls.txt'), 'utf8').trim().split('\n')
  };
}

test('unchanged locks reuse installation; transitive lock changes reinstall it', t => {
  const f = fixture(t);
  let result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(f.html().includes('window.fixtureDependency="1.0.0"'));
  result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /cached local asset reused/);
  assert.deepEqual(f.calls(), ['ci']);

  f.lock.packages['node_modules/transitive'].version = '1.0.1';
  f.saveLock();
  result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(f.html().includes('window.fixtureDependency="1.0.1"'));
  assert.deepEqual(f.calls(), ['ci', 'ci']);
});

test('generated HTML retains extracted bundle notices', t => {
  const f = fixture(t);
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  const notices = JSON.parse(fs.readFileSync(
    path.join(f.cache, 'dist/THIRD_PARTY_NOTICES.json'), 'utf8'));
  assert.ok(notices.some(entry => entry.text.includes('Fixture extracted copyright notice')));
  assert.match(f.html(), /Fixture extracted copyright notice/);
});

test('failed builds release the build lock and preserve the application lock', t => {
  const f = fixture(t);
  const applicationLock = JSON.stringify(f.lock);
  fs.writeFileSync(path.join(f.cache, 'fail-build'), '');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Fixture build failed/);
  assert.equal(fs.existsSync(path.join(f.cache, 'build.lock')), false);
  assert.equal(fs.readFileSync(path.join(f.cache, '../../ckeditor_webview_flutter.lock'), 'utf8'),
    applicationLock);
});

test('failed installation cannot leave a reusable installation stamp', t => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  f.lock.packages['node_modules/transitive'].version = '1.0.1';
  f.saveLock();
  fs.writeFileSync(path.join(f.cache, 'fail-install'), '');
  const failed = f.run();
  assert.equal(failed.status, 1);
  assert.equal(fs.existsSync(path.join(f.cache, 'installation.sha256')), false);
  assert.equal(fs.existsSync(path.join(f.cache, 'build.lock')), false);
  fs.unlinkSync(path.join(f.cache, 'fail-install'));
  const recovered = f.run();
  assert.equal(recovered.status, 0, recovered.stderr);
  assert.ok(f.html().includes('window.fixtureDependency="1.0.1"'));
  assert.deepEqual(f.calls(), ['ci', 'ci', 'ci']);
});
