// SPDX-License-Identifier: GPL-2.0-or-later

const path = require('path');
const webpack = require('webpack');
const { styles } = require('@ckeditor/ckeditor5-dev-utils');
const { CKEditorTranslationsPlugin } = require('@ckeditor/ckeditor5-dev-translations');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
  entry: path.resolve(__dirname, 'editor-entry.js'),
  output: {
    path: path.resolve(__dirname, '../../assets/editor'),
    filename: 'ckeditor.js',
    library: { name: 'CKEDITOR', type: 'window' }
  },
  devtool: false,
  plugins: [
    new CKEditorTranslationsPlugin({ language: 'en' }),
    new MiniCssExtractPlugin({ filename: 'ckeditor.css' }),
    new webpack.BannerPlugin({
      banner: 'CKEditor 5 v41.4.1 | Copyright (c) 2003-2024 CKSource Holding sp. z o.o.\nFor licensing, see CKEDITOR-LICENSE.txt.',
      entryOnly: true
    })
  ],
  module: {
    rules: [
      { test: /\.svg$/, use: ['raw-loader'] },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: styles.getPostCssConfig({
                themeImporter: {
                  themePath: require.resolve('@ckeditor/ckeditor5-theme-lark')
                },
                minify: true
              })
            }
          }
        ]
      }
    ]
  },
  performance: { hints: false }
};
