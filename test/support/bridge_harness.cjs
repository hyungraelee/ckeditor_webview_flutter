// SPDX-License-Identifier: GPL-2.0-or-later

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bridgeSource = fs.readFileSync(
  path.join(__dirname, '../../assets/editor/editor.js'), 'utf8');

// These are the available fixture features, independent of the bridge's lists.
const featureNames = [
  'Essentials', 'Paragraph', 'Heading', 'SourceEditing',
  'Bold', 'Italic', 'Underline', 'Strikethrough',
  'FontFamily', 'FontSize', 'FontColor', 'FontBackgroundColor', 'Highlight',
  'Subscript', 'Superscript', 'HorizontalLine', 'ShowBlocks',
  'SpecialCharacters', 'SpecialCharactersEssentials',
  'Alignment', 'Indent', 'IndentBlock', 'List'
];

function createHarness({ failCreation = false, deferCreation = false,
  creationError = new Error('Fixture creation failed') } = {}) {
  const messages = [];
  const head = [{ id: 'vendor-css' }, { id: 'layout-css' }];
  const inputListeners = new Map();
  const modelListeners = new Map();
  const timers = new Map();
  const locks = new Set();
  const calls = [];
  let now = 0;
  let nextTimer = 0;
  let config;
  let createCalls = 0;
  let destroyed = 0;
  let data = '';
  let sourceMode = false;
  let sourceText = '';
  let releaseCreation;
  const pendingCreation = deferCreation
    ? new Promise(resolve => { releaseCreation = resolve; }) : null;
  const textarea = { focus: () => calls.push('source:focus') };
  const sourceEditing = {
    get isSourceEditingMode() { return sourceMode; },
    set isSourceEditingMode(value) {
      if (sourceMode && !value) data = sourceText;
      sourceMode = value;
      calls.push(`source:${value}`);
    }
  };
  const element = {
    addEventListener: (type, listener) => inputListeners.set(type, listener),
    removeEventListener: type => inputListeners.delete(type),
    querySelector: selector => selector === '.ck-source-editing-area textarea' ? textarea : null
  };
  // This fake returns source text to detect stale bridge reads. It does not
  // implement CKEditor's model conversion or HTML normalization.
  const instance = {
    getData() { return sourceMode ? sourceText : data; },
    setData(value) {
      data = value;
      modelListeners.get('change:data')?.();
    },
    enableReadOnlyMode: key => { locks.add(key); calls.push('readOnly:on'); },
    disableReadOnlyMode: key => { locks.delete(key); calls.push('readOnly:off'); },
    plugins: { get: name => {
      if (name !== 'SourceEditing') throw new Error(`Unknown fixture plugin: ${name}`);
      return sourceEditing;
    } },
    model: { document: { on: (type, listener) => modelListeners.set(type, listener) } },
    editing: { view: { focus: () => calls.push('editable:focus') } },
    ui: { view: { element }, focusTracker: { on() {}, add() {} } },
    destroy: async () => { destroyed++; }
  };
  const bundle = Object.fromEntries(featureNames.map(name => [name, function Plugin() {}]));
  bundle.ClassicEditor = { create: async (_, options) => {
    createCalls++;
    config = options;
    data = options.initialData;
    calls.push('create');
    if (failCreation) throw creationError;
    if (pendingCreation) await pendingCreation;
    return instance;
  } };
  const context = vm.createContext({
    setTimeout(callback, delay) {
      const id = ++nextTimer;
      timers.set(id, { callback, time: now + delay });
      return id;
    },
    clearTimeout: id => timers.delete(id),
    document: {
      documentElement: { classList: { toggle() {} }, style: { setProperty() {} } },
      getElementById() {},
      removeEventListener() {},
      head: { appendChild(style) { head.push(style); calls.push('style:append'); } },
      createElement(tag) {
        if (tag !== 'style') throw new Error(`Unexpected fixture element: ${tag}`);
        const style = { remove() {
          const index = head.indexOf(style);
          if (index >= 0) head.splice(index, 1);
        } };
        Object.defineProperty(style, 'innerHTML', {
          set() { throw new Error('Styles must be assigned as text, not HTML'); }
        });
        return style;
      }
    },
    window: {
      CKEDITOR: bundle,
      CkEditorChannel: { postMessage: value => messages.push(JSON.parse(value)) },
      addEventListener() {},
      removeEventListener() {}
    }
  });
  vm.runInContext(bridgeSource, context, { filename: 'assets/editor/editor.js' });

  return {
    messages, head, calls, locks, bundle,
    initialize(options = {}) {
      // JSON is evaluated inside the VM, matching Flutter's actual boundary.
      return vm.runInContext(`window.ckBridge.initialize(${JSON.stringify(options)})`, context);
    },
    initializeExpression(expression) {
      return vm.runInContext(`window.ckBridge.initialize(${expression})`, context);
    },
    invoke(command, args = []) {
      return JSON.parse(context.window.ckBridge.invoke(command, args));
    },
    edit(html) { data = html; modelListeners.get('change:data')?.(); },
    editSource(html) {
      sourceMode = true;
      sourceText = html;
      inputListeners.get('input')?.({ target: {
        matches: selector => selector === '.ck-source-editing-area textarea'
      } });
    },
    advance(milliseconds) {
      const end = now + milliseconds;
      while (true) {
        const next = [...timers].sort((a, b) => a[1].time - b[1].time)[0];
        if (!next || next[1].time > end) break;
        now = next[1].time;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = end;
    },
    destroy: () => context.window.ckBridge.destroy(),
    releaseCreation: () => releaseCreation(),
    get config() { return config && JSON.parse(JSON.stringify(config)); },
    get pluginNames() {
      return Object.entries(bundle)
        .filter(([, plugin]) => config?.plugins.includes(plugin))
        .map(([name]) => name);
    },
    get createCalls() { return createCalls; },
    get destroyed() { return destroyed; },
    get pendingTimers() { return timers.size; },
    get sourceMode() { return sourceMode; }
  };
}

module.exports = { createHarness };
