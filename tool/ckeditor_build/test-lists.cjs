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

test('real CKEditor list editing', { timeout: 60000 }, async t => {
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
        toolbarItems: ['bulletedList', 'numberedList', '|', 'outdent', 'indent', '|', 'sourceEditing'],
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

  await t.test('imports nested list HTML with hidden buttons and round-trips setHtml', async t => {
    const source = '<ul><li>한국어<ul><li>Nested</li></ul></li></ul><ol><li>First</li><li>Second</li></ol>';
    const page = await editor(t, { initialHtml: source, toolbarItems: [] });
    assert.equal(await html(page), source);
    const replacement = '<ol><li><strong>Updated</strong></li></ol>';
    await page.evaluate(value => window.ckBridge.invoke('setHtml', [value]), replacement);
    assert.equal(await html(page), replacement);
  });

  await t.test('toolbar switches list types, toggles off, and integrates indent controls', async t => {
    const page = await editor(t, { initialHtml: '<p>First</p><p>Second</p>' });
    const toolbar = page.locator('.ck-toolbar');
    await page.evaluate(() => {
      const editor = window.testEditor;
      editor.model.change(writer => writer.setSelection(writer.createRangeIn(editor.model.document.getRoot())));
    });
    await toolbar.getByRole('button', { name: /^Bulleted List(?: \(|$)/ }).click();
    assert.equal(await html(page), '<ul><li>First</li><li>Second</li></ul>');
    await toolbar.getByRole('button', { name: /^Numbered List(?: \(|$)/ }).click();
    const numbered = '<ol><li>First</li><li>Second</li></ol>';
    assert.equal(await html(page), numbered);
    await toolbar.getByRole('button', { name: /^Numbered List(?: \(|$)/ }).click();
    assert.equal(await html(page), '<p>First</p><p>Second</p>');
    await page.evaluate(() => {
      const editor = window.testEditor;
      editor.execute('undo');
      editor.model.change(writer => writer.setSelection(editor.model.document.getRoot().getChild(1), 0));
    });
    await toolbar.getByRole('button', { name: 'Increase indent', exact: true }).click();
    assert.equal(await html(page), '<ol><li>First<ol><li>Second</li></ol></li></ol>');
    await toolbar.getByRole('button', { name: 'Decrease indent', exact: true }).click();
    assert.equal(await html(page), numbered);
  });

  await t.test('keyboard list editing updates auto-height and exits lists', async t => {
    const page = await editor(t, { initialHtml: '<ul><li>First</li></ul>', autoHeight: true, minHeight: 80 });
    await page.waitForFunction(() => window.testMessages.some(event => event.type === 'resize'));
    const initialHeight = await page.evaluate(() => window.testMessages
      .filter(event => event.type === 'resize').at(-1).data.height);
    await page.evaluate(() => {
      const editor = window.testEditor;
      editor.model.change(writer => writer.setSelection(editor.model.document.getRoot().getChild(0), 'end'));
      editor.editing.view.focus();
    });
    await page.keyboard.press('Enter');
    await page.keyboard.type('Second');
    assert.equal(await html(page), '<ul><li>First</li><li>Second</li></ul>');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('After');
    assert.equal(await html(page), '<ul><li>First</li><li>Second</li></ul><p>After</p>');
    await page.waitForFunction(height => window.testMessages
      .filter(event => event.type === 'resize').at(-1).data.height > height, initialHeight);
    await page.evaluate(() => {
      window.ckBridge.invoke('setHtml', ['<ol><li>First</li><li>Second</li></ol>']);
      const editor = window.testEditor;
      editor.model.change(writer => writer.setSelection(editor.model.document.getRoot().getChild(0), 0));
      editor.editing.view.focus();
    });
    await page.keyboard.press('Backspace');
    assert.equal(await html(page), '<p>First</p><ol><li>Second</li></ol>');
  });

  await t.test('getHtml reads list edits in source mode before debounce', async t => {
    const page = await editor(t, { changeDebounceMs: 10000 });
    await page.locator('.ck-toolbar').getByRole('button', { name: /^Source(?: editing)?$/ }).click();
    const source = '<ul><li>Latest</li></ul><ol><li>Source</li></ol>';
    await page.locator('.ck-source-editing-area textarea').fill(source);
    assert.equal(await html(page), source);
  });

  await t.test('read-only disables list editing and preserves HTML', async t => {
    const source = '<ul><li>Read only</li></ul>';
    const page = await editor(t, { initialHtml: source, readOnly: true });
    assert.deepEqual(await page.evaluate(() => ['bulletedList', 'numberedList', 'indentList', 'outdentList']
      .map(name => window.testEditor.commands.get(name).isEnabled)), [false, false, false, false]);
    assert.equal(await html(page), source);
    await page.evaluate(() => window.ckBridge.invoke('setReadOnly', [false]));
    assert.equal(await page.evaluate(() => window.testEditor.commands.get('bulletedList').isEnabled), true);
  });

  await t.test('plain-text list markers are not automatically converted', async t => {
    const page = await editor(t, { initialHtml: '' });
    await page.locator('.ck-editor__editable').click();
    await page.keyboard.type('- plain');
    await page.keyboard.press('Enter');
    await page.keyboard.type('1. plain');
    assert.equal(await html(page), '<p>- plain</p><p>1. plain</p>');
  });
});
