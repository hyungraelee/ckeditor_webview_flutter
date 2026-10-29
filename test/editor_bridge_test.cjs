// SPDX-License-Identifier: GPL-2.0-or-later

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createHarness } = require('./support/bridge_harness.cjs');

test('HTML stays exact through commands and CSS never enters document data', async t => {
  const h = createHarness();
  t.after(() => h.destroy());
  const html = '<p title="quotes">한국어 \\ path\n</script> &amp;</p>';
  const css = '.ck-content::before { content: "</style><script>throw 1</script>"; }\n';
  await h.initialize({ initialHtml: html, customCss: css });
  assert.deepEqual(h.messages, [{ type: 'ready' }]);
  assert.equal(h.head.at(-1).textContent, css);
  assert.deepEqual(h.invoke('getHtml'), { ok: true, data: html });
  const replacement = '<h2>New data</h2>';
  assert.equal(h.invoke('setHtml', [replacement]).ok, true);
  assert.equal(h.invoke('getHtml').data, replacement);
  assert.equal(h.invoke('clear').ok, true);
  assert.equal(h.invoke('getHtml').data, '');
});

test('getHtml reads current source editing before the change debounce fires', async t => {
  const h = createHarness();
  t.after(() => h.destroy());
  await h.initialize({ initialHtml: '<p>Earlier model</p>' });
  h.editSource('<p>Latest source</p>');
  assert.equal(h.messages.filter(event => event.type === 'change').length, 0);
  assert.equal(h.invoke('getHtml').data, '<p>Latest source</p>');
  h.advance(300);
  assert.deepEqual(h.messages.at(-1), { type: 'change', data: { html: '<p>Latest source</p>' } });
});

test('setHtml exits source mode so stale textarea data cannot overwrite it', async t => {
  const h = createHarness();
  t.after(() => h.destroy());
  await h.initialize();
  h.editSource('<p>Old source</p>');
  h.invoke('setHtml', ['<p>Replacement</p>']);
  assert.equal(h.sourceMode, false);
  assert.equal(h.invoke('getHtml').data, '<p>Replacement</p>');
  h.advance(300);
  assert.equal(h.messages.at(-1).data.html, '<p>Replacement</p>');
});

test('read-only commits source edits and focus chooses the active editing mode', async t => {
  const h = createHarness();
  t.after(() => h.destroy());
  await h.initialize();
  h.invoke('focus');
  assert.equal(h.calls.at(-1), 'editable:focus');
  h.editSource('<p>Commit before locking</p>');
  h.invoke('focus');
  assert.equal(h.calls.at(-1), 'source:focus');
  h.invoke('setReadOnly', [true]);
  assert.deepEqual(h.calls.slice(-2), ['source:false', 'readOnly:on']);
  assert.equal(h.invoke('getHtml').data, '<p>Commit before locking</p>');
  assert.ok(h.locks.has('flutter'));
  h.invoke('setReadOnly', [false]);
  assert.equal(h.locks.size, 0);
});

test('debounce coalesces edits, suppresses duplicate data, and honors custom delay', async t => {
  const h = createHarness();
  t.after(() => h.destroy());
  await h.initialize({ changeDebounceMs: 50 });
  h.edit('<p>First</p>');
  h.advance(40);
  h.edit('<p>Second</p>');
  h.advance(49);
  assert.equal(h.messages.length, 1);
  h.advance(1);
  assert.deepEqual(h.messages.at(-1), { type: 'change', data: { html: '<p>Second</p>' } });
  h.edit('<p>Second</p>');
  h.advance(50);
  assert.equal(h.messages.length, 2);
});

test('feature settings coexist with managed options and hidden features stay enabled', async t => {
  const h = createHarness();
  t.after(() => h.destroy());
  const config = {
    fontSize: { options: [12, 16, 'default'], supportAllValues: true },
    fontColor: { colors: [{ color: '#1976D2', label: 'Blue' }] },
    heading: { options: [{ model: 'paragraph', title: 'Body', class: 'ck-heading_paragraph' }] },
    placeholder: 'Write "here"\n한국어'
  };
  await h.initialize({ config, toolbarItems: [], uiLanguage: 'en', licenseKey: 'runtime-key' });
  for (const [key, value] of Object.entries(config)) assert.deepEqual(h.config[key], value);
  assert.deepEqual(h.config.toolbar, { items: [], shouldNotGroupWhenFull: false });
  assert.deepEqual(h.config.language, { ui: 'en', content: 'en' });
  assert.equal(h.config.licenseKey, 'runtime-key');
  for (const hiddenFeature of ['Heading', 'SourceEditing', 'Bold', 'FontSize', 'FontColor']) {
    assert.ok(h.pluginNames.includes(hiddenFeature), `${hiddenFeature} must remain enabled`);
  }
  assert.equal(Object.hasOwn(h.config, 'customCss'), false);
});

for (const key of ['plugins', 'removePlugins', 'toolbar', 'initialData', 'language',
  'translations', 'licenseKey', 'htmlSupport', 'fontSzie']) {
  test(`config cannot override managed or unsupported key: ${key}`, async t => {
    const h = createHarness();
    t.after(() => h.destroy());
    await h.initialize({ config: { [key]: {} } });
    assert.equal(h.createCalls, 0);
    assert.equal(h.messages.at(-1).data.code, 'invalid_editor_config');
  });
}

for (const [name, expression] of [
  ['non-finite number', '{config: {fontSize: {options: [NaN]}}}'],
  ['callback', '{config: {fontSize: {callback: () => {}}}}'],
  ['cycle', '(() => {const value = {}; value.loop = value; return {config: {fontSize: value}};})()'],
  ['prototype key', 'JSON.parse(\'{"config":{"fontSize":{"__proto__":{"polluted":true}}}}\')'],
  ['dotted key', '{config: {fontSize: {"constructor.prototype": {polluted: true}}}}']
]) {
  test(`invalid config is rejected before editor creation: ${name}`, async t => {
    const h = createHarness();
    t.after(() => h.destroy());
    await h.initializeExpression(expression);
    assert.equal(h.createCalls, 0);
    assert.equal(h.messages.at(-1).data.code, 'invalid_editor_config');
    assert.equal({}.polluted, undefined);
  });
}

test('link toolbar and JSON settings reach the editor', async t => {
  const h = createHarness();
  t.after(() => h.destroy());
  const link = { defaultProtocol: 'https://', addTargetToExternalLinks: true };
  await h.initialize({ toolbarItems: ['bold', '|', 'link'], config: { link } });
  assert.deepEqual(h.config.link, link);
  assert.deepEqual(h.config.toolbar.items, ['bold', '|', 'link']);
  assert.ok(h.pluginNames.includes('Link'));
});

test('null and empty options preserve default features, toolbar, and CSS', async t => {
  for (const empty of [null, '']) {
    const h = createHarness();
    t.after(() => h.destroy());
    await h.initialize({ config: empty === null ? null : {}, customCss: empty });
    assert.equal(h.head.length, 2);
    assert.equal(Object.hasOwn(h.config, 'fontSize'), false);
    assert.ok(h.config.toolbar.items.includes('fontSize'));
    assert.equal(h.config.toolbar.items.includes('link'), false);
    assert.ok(h.pluginNames.includes('Link'));
    assert.equal(Object.hasOwn(h.config, 'licenseKey'), false);
  }
});

test('CSS follows base styles before create and is removed on disposal', async () => {
  const h = createHarness();
  await h.initialize({ customCss: ':root { --ck-color-toolbar-background: #eef2ff; }' });
  assert.deepEqual(h.calls.slice(0, 2), ['style:append', 'create']);
  assert.equal(h.head.at(-1).id, 'ckeditor-flutter-custom-css');
  await h.initialize({ customCss: 'different' });
  assert.equal(h.createCalls, 1);
  assert.equal(h.head.length, 3);
  h.edit('<p>Pending change</p>');
  assert.equal(h.pendingTimers, 1);
  await h.destroy();
  assert.equal(h.head.length, 2);
  assert.equal(h.pendingTimers, 0);
  h.advance(1000);
  assert.equal(h.messages.length, 1);
  assert.equal(h.invoke('getHtml').error.code, 'disposed');
  await h.destroy();
  assert.equal(h.destroyed, 1);
});

test('invalid toolbar, CSS and activation fail through the error channel', async t => {
  for (const [options, code] of [
    [{ toolbarItems: ['unsupported'] }, 'invalid_toolbar_items'],
    [{ customCss: {} }, 'invalid_custom_css'],
    [{ licenseKey: '  ' }, 'invalid_license_key']
  ]) {
    const h = createHarness();
    t.after(() => h.destroy());
    await h.initialize(options);
    assert.equal(h.createCalls, 0);
    assert.equal(h.head.length, 2);
    assert.equal(h.messages.at(-1).data.code, code);
  }
});

test('failed creation removes CSS and does not announce ready', async t => {
  const h = createHarness({ failCreation: true });
  t.after(() => h.destroy());
  await h.initialize({ customCss: '.ck-content { color: navy; }' });
  assert.equal(h.head.length, 2);
  assert.equal(h.messages.length, 1);
  assert.equal(h.messages[0].data.code, 'editor_create_failed');
});

for (const reason of [null, 'Rejected by the engine', 7]) {
  test(`non-Error creation rejection reaches the error channel: ${reason}`, async t => {
    const h = createHarness({ failCreation: true, creationError: reason });
    t.after(() => h.destroy());
    await h.initialize({ customCss: '.ck-content { color: navy; }' });
    assert.equal(h.head.length, 2);
    assert.deepEqual(h.messages, [{ type: 'error', data: {
      code: 'editor_create_failed', message: String(reason)
    } }]);
  });
}

test('disposal during pending creation destroys the late editor without events', async () => {
  const h = createHarness({ deferCreation: true });
  const initialization = h.initialize({ customCss: '.ck-content { color: navy; }' });
  assert.equal(h.head.length, 3);
  await h.destroy();
  assert.equal(h.head.length, 2);
  h.releaseCreation();
  await initialization;
  assert.equal(h.destroyed, 1);
  assert.deepEqual(h.messages, []);
  assert.equal(h.invoke('getHtml').error.code, 'disposed');
});
