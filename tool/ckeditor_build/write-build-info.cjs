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
const sha256 = {};
for (const name of ['ckeditor.js', 'ckeditor.css']) {
  sha256[name] = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(assetPath, name))).digest('hex');
}
fs.writeFileSync(path.join(assetPath, 'build-info.json'), JSON.stringify({
  version,
  language: 'ko',
  packages: packageInfo.dependencies,
  sha256
}, null, 2) + '\n');
