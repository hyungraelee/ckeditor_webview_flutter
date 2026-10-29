// SPDX-License-Identifier: GPL-2.0-or-later
'use strict';

// Optional real-browser tests; see CONTRIBUTING.md for Playwright setup.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright');

const assets = path.resolve(__dirname, '../../assets/editor');
const generated = process.env.CKEDITOR_TEST_ASSET;

test('real CKEditor hyperlink editing', { timeout: 60000 }, async t => {
  const server = http.createServer((request, response) => {
    const name = new URL(request.url, 'http://localhost').pathname.slice(1) || 'index.html';
    if (!['index.html', 'editor.js', 'editor.css', 'ckeditor.js', 'ckeditor.css'].includes(name)) {
      response.writeHead(404).end();
      return;
    }
    const file = generated && name === 'index.html' ? path.resolve(generated) : path.join(assets, name);
    response.setHeader('Content-Type', name.endsWith('.css') ? 'text/css'
      : name.endsWith('.js') ? 'text/javascript' : 'text/html');
    response.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  t.after(async () => {
    if (browser) await browser.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  browser = await chromium.launch({
    channel: process.env.CKEDITOR_TEST_BROWSER_CHANNEL || undefined, headless: true,
  });

  async function editor(t, options = {}) {
    const page = await browser.newPage();
    t.after(() => page.close());
    page.setDefaultTimeout(10000);
    // Keep this test local: translations are disabled by the English UI.
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1'
      ? route.continue() : route.abort());
    await page.goto(`http://127.0.0.1:${server.address().port}/`);
    await page.waitForFunction(() => window.CKEDITOR?.ClassicEditor && window.ckBridge);
    await page.evaluate(async options => {
      window.testMessages = [];
      window.CkEditorChannel = { postMessage: data => window.testMessages.push(JSON.parse(data)) };
      const create = window.CKEDITOR.ClassicEditor.create.bind(window.CKEDITOR.ClassicEditor);
      window.CKEDITOR.ClassicEditor.create = async (...args) => {
        window.testEditor = await create(...args);
        return window.testEditor;
      };
      await window.ckBridge.initialize({ initialHtml: '<p>Example</p>',
        toolbarItems: ['bold', '|', 'link', '|', 'sourceEditing'],
        config: { link: { defaultProtocol: 'https://' } },
        uiLanguage: 'en', licenseKey: 'GPL', ...options });
    }, options);
    const messages = await page.evaluate(() => window.testMessages);
    assert.ok(messages.some(event => event.type === 'ready'), JSON.stringify(messages));
    assert.equal(messages.some(event => event.type === 'error'), false, JSON.stringify(messages));
    return page;
  }

  async function html(page) {
    const result = await page.evaluate(() => JSON.parse(window.ckBridge.invoke('getHtml')));
    assert.equal(result.ok, true);
    return result.data;
  }

  await t.test('imports link HTML with the toolbar hidden and round-trips setHtml', async t => {
    const source = '<p><a href="https://example.com/?a=1&amp;b=2">한국어</a></p>';
    const page = await editor(t, { initialHtml: source, toolbarItems: [] });
    assert.equal(await html(page), source);
    assert.equal(await page.evaluate(() => window.testEditor.plugins.has('Link')), true);
    const replacement = '<p><a href="mailto:editor@example.com">Email</a></p>';
    await page.evaluate(value => window.ckBridge.invoke('setHtml', [value]), replacement);
    assert.equal(await html(page), replacement);
  });

  await t.test('inserts through the link UI, edits, unlinks, and undoes', async t => {
    const page = await editor(t);
    await page.evaluate(() => {
      const editor = window.testEditor;
      editor.model.change(writer => writer.setSelection(
        writer.createRangeIn(editor.model.document.getRoot().getChild(0))));
    });
    await page.locator('.ck-toolbar').getByRole('button', { name: /^Link(?: \(|$)/ }).click();
    await page.getByLabel('Link URL').fill('example.com/path');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await html(page), '<p><a href="https://example.com/path">Example</a></p>');
    await page.getByRole('button', { name: 'Edit link', exact: true }).click();
    await page.getByLabel('Link URL').fill('https://example.org/updated');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    assert.equal(await html(page), '<p><a href="https://example.org/updated">Example</a></p>');
    await page.getByRole('button', { name: 'Unlink', exact: true }).click();
    assert.equal(await html(page), '<p>Example</p>');
    await page.evaluate(() => window.testEditor.execute('undo'));
    assert.equal(await html(page), '<p><a href="https://example.org/updated">Example</a></p>');
  });

  await t.test('getHtml reads source-edited links before debounce', async t => {
    const page = await editor(t, { changeDebounceMs: 10000 });
    await page.locator('.ck-toolbar').getByRole('button', { name: /^Source(?: editing)?$/ }).click();
    await page.locator('.ck-source-editing-area textarea').fill(
      '<p><a href="https://example.com/source">Source link</a></p>');
    assert.equal(await html(page), '<p><a href="https://example.com/source">Source link</a></p>');
  });

  await t.test('auto-height captures gestures while the link balloon is open', async t => {
    const page = await editor(t, { autoHeight: true });
    await page.waitForFunction(() => window.testMessages.filter(event => event.type === 'resize')
      .at(-1)?.data.captureGestures === false);
    await page.evaluate(() => {
      const editor = window.testEditor;
      editor.model.change(writer => writer.setSelection(editor.model.document.getRoot().getChild(0), 2));
      editor.editing.view.focus();
    });
    await page.locator('.ck-toolbar').getByRole('button', { name: /^Link(?: \(|$)/ }).click();
    await page.getByLabel('Link URL').fill('example.com');
    await page.waitForFunction(() => window.testMessages.filter(event => event.type === 'resize')
      .at(-1)?.data.captureGestures === true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.testMessages.filter(event => event.type === 'resize')
      .at(-1)?.data.captureGestures === false);
  });

  await t.test('read-only disables link editing and preserves data', async t => {
    const source = '<p><a href="https://example.com/">Read only</a></p>';
    const page = await editor(t, { initialHtml: source, readOnly: true });
    assert.equal(await page.evaluate(() => window.testEditor.commands.get('link').isEnabled), false);
    assert.equal(await page.evaluate(() => window.testEditor.commands.get('unlink').isEnabled), false);
    assert.equal(await html(page), source);
  });

  await t.test('typing a URL keeps the existing plain-text behavior', async t => {
    const page = await editor(t, { initialHtml: '', toolbarItems: [] });
    assert.equal(await page.evaluate(() => !window.testEditor.plugins.has('AutoLink') ||
      !window.testEditor.plugins.get('AutoLink').isEnabled), true);
    await page.locator('.ck-editor__editable').click();
    await page.keyboard.type('https://example.com ');
    assert.doesNotMatch(await html(page), /<a\b/);
  });
});
