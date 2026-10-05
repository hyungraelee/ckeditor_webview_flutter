// SPDX-License-Identifier: GPL-2.0-or-later

'use strict';

// Use the original source-import toolchain for releases before modern packages.
module.exports = async ({ requireFromCache, cache, dist, entryPath }) => {
  const webpack = requireFromCache('webpack');
  const { styles } = requireFromCache('@ckeditor/ckeditor5-dev-utils');
  const { CKEditorTranslationsPlugin } = requireFromCache('@ckeditor/ckeditor5-dev-translations');
  const MiniCssExtractPlugin = requireFromCache('mini-css-extract-plugin');
  const compiler = webpack({
    mode: 'production', context: cache, entry: entryPath,
    output: { path: dist, filename: 'ckeditor.js', library: { name: 'CKEDITOR', type: 'window' } },
    devtool: false,
    resolveLoader: { modules: [require('node:path').join(cache, 'node_modules')] },
    plugins: [new CKEditorTranslationsPlugin({ language: 'en',
      corePackageSampleResourcePath: requireFromCache.resolve('@ckeditor/ckeditor5-core/src/editor/editor.js'),
      corePackageContextsResourcePath: requireFromCache.resolve('@ckeditor/ckeditor5-core/lang/contexts.json')
    }),
      new MiniCssExtractPlugin({ filename: 'ckeditor.css' })],
    module: { rules: [
      { test: /\.svg$/, use: ['raw-loader'] },
      { test: /\.css$/, use: [MiniCssExtractPlugin.loader, 'css-loader',
        { loader: 'postcss-loader', options: {
          postcssOptions: styles.getPostCssConfig({ themeImporter: {
            themePath: requireFromCache.resolve('@ckeditor/ckeditor5-theme-lark')
          }, minify: true })
        } }]
      }
    ] },
    performance: { hints: false }
  });
  await new Promise((resolve, reject) => {
    compiler.run((error, stats) => {
      compiler.close(closeError => {
        if (error || closeError) return reject(error || closeError);
        if (stats.hasErrors()) {
          return reject(new Error('Legacy editor build failed. This version may not '
            + 'provide the required plugins or source layout.\n'
            + stats.toString({ all: false, errors: true })));
        }
        resolve();
      });
    });
  });
};
