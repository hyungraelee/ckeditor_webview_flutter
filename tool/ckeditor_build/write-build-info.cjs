// SPDX-License-Identifier: GPL-2.0-or-later

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const packageInfo = require('./package.json');
const lock = require('./package-lock.json');
const assetPath = path.resolve(__dirname, '../../assets/editor');
const version = '41.4.1';

for (const [name, info] of Object.entries(lock.packages)) {
  if (/node_modules\/@ckeditor\/ckeditor5-(?!dev-)/.test(name) && info.version !== version) {
    throw new Error(`Mixed CKEditor versions: ${name}@${info.version}`);
  }
}

fs.copyFileSync(
  path.resolve(__dirname, 'node_modules/@ckeditor/ckeditor5-core/LICENSE.md'),
  path.join(assetPath, 'CKEDITOR-LICENSE.txt')
);
fs.copyFileSync(
  path.resolve(__dirname, 'node_modules/lodash-es/LICENSE'),
  path.join(assetPath, 'LODASH-LICENSE.txt')
);

// Keep the audited color UI notices intact when rebuilding the pinned bundle.
// Review the emitted module inventory again when changing editor dependencies.
const notices = [
  'Third-party MIT components in the bundled CKEditor 5 41.4.1 color UI.\n' +
  'Original upstream license texts and acknowledgments follow.\n' +
  'Lodash notices remain separately preserved in LODASH-LICENSE.txt.\n'
];
for (const name of ['vanilla-colorful', 'color-parse', 'color-convert', 'color-name']) {
  const packagePath = path.resolve(__dirname, 'node_modules', name);
  const dependency = JSON.parse(fs.readFileSync(path.join(packagePath, 'package.json'), 'utf8'));
  const separator = '='.repeat(72);
  notices.push(`\n${separator}\n${name} ${dependency.version} — MIT\n${separator}\n\n` +
    fs.readFileSync(path.join(packagePath, 'LICENSE'), 'utf8'));
  if (name === 'vanilla-colorful') {
    notices.push('\nOriginal ACKNOWLEDGMENTS:\n\n' +
      fs.readFileSync(path.join(packagePath, 'ACKNOWLEDGMENTS'), 'utf8'));
  }
}
fs.writeFileSync(path.join(assetPath, 'THIRD_PARTY_LICENSES.txt'), notices.join(''));

const sha256 = {};
for (const name of ['ckeditor.js', 'ckeditor.css']) {
  sha256[name] = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(assetPath, name))).digest('hex');
}
fs.writeFileSync(path.join(assetPath, 'build-info.json'), JSON.stringify({
  version,
  language: 'en',
  packages: packageInfo.dependencies,
  sha256
}, null, 2) + '\n');
