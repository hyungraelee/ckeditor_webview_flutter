(() => {
  'use strict';

  const EVENT = Object.freeze({
    ready: 'ready',
    change: 'change',
    focus: 'focus',
    blur: 'blur',
    resize: 'resize',
    error: 'error'
  });
  const READ_ONLY_LOCK = 'flutter';
  const DEFAULT_CHANGE_DEBOUNCE_MS = 300;
  const COMMAND_ERROR = Object.freeze({
    setHtml: 'set_data_failed', getHtml: 'get_data_failed',
    setReadOnly: 'read_only_failed', focus: 'focus_failed', clear: 'set_data_failed'
  });
  const PLUGINS = Object.freeze([
    'Essentials', 'Paragraph', 'Heading', 'SourceEditing',
    'Bold', 'Italic', 'Underline', 'Strikethrough',
    'FontFamily', 'FontSize', 'FontColor', 'FontBackgroundColor', 'Highlight',
    'Subscript', 'Superscript', 'HorizontalLine', 'ShowBlocks',
    'SpecialCharacters', 'SpecialCharactersEssentials',
    'Alignment', 'Indent', 'IndentBlock'
  ]);
  // Matches the supplied web toolbar. Overflow stays in CKEditor's More menu.
  const TOOLBAR = Object.freeze([
    'heading', '|', 'sourceEditing', '|',
    'bold', 'italic', 'underline', 'strikethrough', '|',
    'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor', 'highlight',
    'subscript', 'superscript', '|',
    'horizontalLine', 'showBlocks', 'specialCharacters', '|',
    'alignment', 'outdent', 'indent'
  ]);

  let editor = null;
  let state = 'notInitialized';
  let initialization = null;
  let loadError = null;
  let changeTimer = null;
  let changeDebounceMs = DEFAULT_CHANGE_DEBOUNCE_MS;
  let lastEmittedHtml = '';
  let editorElement = null;
  let autoHeight = false;
  let layoutFrame = null;
  let resizeObserver = null;
  let mutationObserver = null;
  let lastLayout = '';

  function scheduleLayout() {
    if (!autoHeight || state !== 'ready' || layoutFrame !== null) return;
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = null;
      if (state !== 'ready' || !editorElement) return;
      // Measure from the document origin, even after CKEditor's focus scrolling.
      if (window.scrollY) window.scrollTo(0, 0);
      const toolbar = editorElement.querySelector('.ck-editor__top');
      const toolbarHeight = Math.ceil(toolbar.getBoundingClientRect().height);
      document.documentElement.style.setProperty('--editor-toolbar-height', `${toolbarHeight}px`);
      const selection = window.getSelection();
      const inEditor = selection && selection.anchorNode && editorElement.contains(selection.anchorNode);
      const editable = document.activeElement;
      let caretTop = null;
      let caretBottom = null;
      if (inEditor && selection.isCollapsed && selection.rangeCount &&
          editable && editable.classList.contains('ck-editor__editable')) {
        let rect = selection.getRangeAt(0).getBoundingClientRect();
        // Empty paragraphs may have a zero-sized collapsed DOM range.
        if (!rect.height) {
          const node = selection.anchorNode;
          const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
          rect = element.getBoundingClientRect();
        }
        caretTop = Math.round(rect.top);
        caretBottom = Math.round(rect.bottom);
      }
      const captureGestures = !!editorElement.querySelector('[aria-expanded="true"]') ||
        !!(inEditor && !selection.isCollapsed);
      const data = {
        height: Math.ceil(editorElement.getBoundingClientRect().height),
        caretTop, caretBottom, captureGestures
      };
      const serialized = JSON.stringify(data);
      if (data.height > 0 && serialized !== lastLayout) {
        lastLayout = serialized;
        post(EVENT.resize, data);
      }
    });
  }

  function stopLayout() {
    if (layoutFrame !== null) cancelAnimationFrame(layoutFrame);
    layoutFrame = null;
    if (resizeObserver) resizeObserver.disconnect();
    if (mutationObserver) mutationObserver.disconnect();
    document.removeEventListener('selectionchange', scheduleLayout);
    window.removeEventListener('resize', scheduleLayout);
  }

  function startLayout() {
    if (!autoHeight) return;
    resizeObserver = new ResizeObserver(scheduleLayout);
    resizeObserver.observe(editorElement);
    mutationObserver = new MutationObserver(scheduleLayout);
    mutationObserver.observe(editorElement, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ['aria-expanded']
    });
    editor.ui.on('update', scheduleLayout);
    document.addEventListener('selectionchange', scheduleLayout);
    window.addEventListener('resize', scheduleLayout);
    scheduleLayout();
  }

  function bridgeError(code, message) {
    const error = new Error(message);
    error.bridgeCode = code;
    return error;
  }

  function errorData(error, fallbackCode) {
    return {
      code: error.bridgeCode || fallbackCode,
      message: error.message || String(error)
    };
  }

  function post(type, data) {
    // Flutter registers this JavaScriptChannel before loading index.html.
    if (state === 'disposed') return;
    if (window.CkEditorChannel) {
      window.CkEditorChannel.postMessage(JSON.stringify({ type, data }));
    }
  }

  function requireEditor() {
    if (state !== 'ready' || !editor) {
      throw bridgeError(state === 'disposed' ? 'disposed' : 'editor_not_ready',
        `Editor is ${state}.`);
    }
    return editor;
  }

  function cancelChange() {
    clearTimeout(changeTimer);
    changeTimer = null;
  }

  function scheduleChange() {
    if (state !== 'ready') return;
    cancelChange();
    changeTimer = setTimeout(() => {
      changeTimer = null;
      try {
        // SourceEditing also synchronizes its textarea through getData().
        const html = requireEditor().getData();
        if (html !== lastEmittedHtml) {
          lastEmittedHtml = html;
          post(EVENT.change, { html });
        }
      } catch (error) {
        post(EVENT.error, errorData(error, 'get_data_failed'));
      }
    }, changeDebounceMs);
  }

  function onSourceInput(event) {
    if (event.target.matches('.ck-source-editing-area textarea')) {
      scheduleChange();
      scheduleLayout();
    }
  }

  function setReadOnly(value) {
    if (typeof value !== 'boolean') {
      throw bridgeError('invalid_argument', 'readOnly must be a boolean.');
    }
    const instance = requireEditor();
    // Commit source edits before making the textarea read-only.
    const source = instance.plugins.get('SourceEditing');
    if (value && source.isSourceEditingMode) {
      source.isSourceEditingMode = false;
    }
    if (value) instance.enableReadOnlyMode(READ_ONLY_LOCK);
    else instance.disableReadOnlyMode(READ_ONLY_LOCK);
  }

  async function initialize(options = {}) {
    if (state === 'disposed') {
      post(EVENT.error, { code: 'disposed', message: 'Editor is disposed.' });
      return;
    }
    if (initialization) return initialization;
    initialization = createEditor(options);
    return initialization;
  }

  async function createEditor(options) {
    state = 'loading';
    try {
      if (loadError) throw loadError;
      const bundle = window.CKEDITOR;
      if (!bundle || !bundle.ClassicEditor) {
        throw bridgeError('bundle_load_failed', 'Local CKEditor bundle is unavailable.');
      }
      const missing = PLUGINS.filter(name => !bundle[name]);
      if (missing.length) {
        throw bridgeError('plugins_missing', `Missing plugins: ${missing.join(', ')}`);
      }
      const initialHtml = options.initialHtml ?? '';
      const readOnly = options.readOnly ?? false;
      const debounceMs = options.changeDebounceMs ?? DEFAULT_CHANGE_DEBOUNCE_MS;
      const expand = options.autoHeight ?? false;
      const minHeight = options.minHeight ?? 300;
      if (typeof initialHtml !== 'string' || typeof readOnly !== 'boolean' ||
          !Number.isInteger(debounceMs) || debounceMs < 0 ||
          typeof expand !== 'boolean' || !Number.isFinite(minHeight) || minHeight <= 0) {
        throw bridgeError('invalid_argument', 'Invalid editor initialization options.');
      }
      changeDebounceMs = debounceMs;
      autoHeight = expand;
      document.documentElement.classList.toggle('editor-auto-height', expand);
      document.documentElement.style.setProperty('--editor-min-height', `${minHeight}px`);
      // Feature options intentionally remain at CKEditor defaults.
      // HTML goes through the CKEditor model; never assign it to innerHTML.
      const config = {
        initialData: initialHtml,
        language: 'ko',
        plugins: PLUGINS.map(name => bundle[name]),
        toolbar: { items: [...TOOLBAR], shouldNotGroupWhenFull: false }
      };
      // 41.x does not require the licenseKey initialization option added in 44.x.
      const instance = await bundle.ClassicEditor.create(
        document.getElementById('editor'), config
      );
      // A widget may have been disposed while CKEditor.create() was pending.
      if (state === 'disposed' || loadError) {
        await instance.destroy();
        if (loadError && state !== 'disposed') throw loadError;
        return;
      }
      editor = instance;
      if (readOnly) instance.enableReadOnlyMode(READ_ONLY_LOCK);
      lastEmittedHtml = instance.getData();
      instance.model.document.on('change:data', scheduleChange);
      instance.ui.focusTracker.on('change:isFocused', (event, name, focused) => {
        post(focused ? EVENT.focus : EVENT.blur);
        scheduleLayout();
      });
      editorElement = instance.ui.view.element;
      // SourceEditing's textarea replaces the tracked editable DOM element.
      instance.ui.focusTracker.add(editorElement);
      editorElement.addEventListener('input', onSourceInput);
      state = 'ready';
      post(EVENT.ready);
      startLayout();
    } catch (error) {
      if (state === 'disposed') return;
      state = 'error';
      cancelChange();
      stopLayout();
      const failedEditor = editor;
      editor = null;
      if (failedEditor) {
        try { await failedEditor.destroy(); } catch (_) { /* Keep original error. */ }
      }
      post(EVENT.error, errorData(error, 'editor_create_failed'));
    }
  }

  const commands = {
    setHtml(html) {
      if (typeof html !== 'string') {
        throw bridgeError('invalid_argument', 'html must be a string.');
      }
      const instance = requireEditor();
      // Exit source mode so its old textarea cannot overwrite the new data.
      const source = instance.plugins.get('SourceEditing');
      if (source.isSourceEditingMode) source.isSourceEditingMode = false;
      instance.setData(html);
    },
    getHtml() {
      return requireEditor().getData();
    },
    setReadOnly,
    focus() {
      const instance = requireEditor();
      const source = editorElement.querySelector('.ck-source-editing-area textarea');
      if (instance.plugins.get('SourceEditing').isSourceEditingMode && source) {
        source.focus();
      } else {
        instance.editing.view.focus();
      }
    },
    clear() {
      commands.setHtml('');
    }
  };

  async function destroy() {
    if (state === 'disposed') return;
    state = 'disposed';
    cancelChange();
    stopLayout();
    if (editorElement) editorElement.removeEventListener('input', onSourceInput);
    editorElement = null;
    const instance = editor;
    editor = null;
    if (instance) {
      try { await instance.destroy(); } catch (_) { /* WebView is being removed. */ }
    }
  }

  window.ckBridge = Object.freeze({
    initialize,
    ...commands,
    // Flutter decodes this JSON envelope instead of platform-specific JS values.
    // Async initialization is acknowledged by the ready/error channel events.
    invoke(command, args = []) {
      try {
        if (!Object.prototype.hasOwnProperty.call(commands, command) || !Array.isArray(args)) {
          throw bridgeError('invalid_command', 'Unknown editor bridge command.');
        }
        return JSON.stringify({ ok: true, data: commands[command](...args) ?? null });
      } catch (error) {
        const data = errorData(error, COMMAND_ERROR[command] || 'bridge_call_failed');
        return JSON.stringify({ ok: false, error: data });
      }
    },
    destroy
  });

  window.addEventListener('error', event => {
    if (state === 'disposed') return;
    const resource = event.target;
    if (resource instanceof HTMLScriptElement || resource instanceof HTMLLinkElement) {
      loadError = bridgeError('asset_load_failed',
        `Editor asset failed to load: ${resource.getAttribute('src') || resource.getAttribute('href')}`);
      state = 'error';
      cancelChange();
      post(EVENT.error, errorData(loadError, 'asset_load_failed'));
    } else {
      post(EVENT.error, errorData(event.error || new Error(event.message), 'javascript_error'));
    }
  }, true);
  window.addEventListener('unhandledrejection', event => {
    post(EVENT.error, errorData(event.reason || new Error('Unknown rejection'), 'javascript_error'));
  });
  window.addEventListener('pagehide', () => { void destroy(); });
})();
