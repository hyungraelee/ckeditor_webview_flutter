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
    'Alignment', 'Indent', 'IndentBlock', 'Link'
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
  const SUPPORTED_TOOLBAR_ITEMS = new Set([...TOOLBAR, 'undo', 'redo', 'link']);
  // Only configure features already included in both engine build recipes.
  const SUPPORTED_CONFIG_KEYS = new Set([
    'heading', 'fontFamily', 'fontSize', 'fontColor', 'fontBackgroundColor',
    'highlight', 'alignment', 'indentBlock', 'specialCharacters', 'placeholder', 'link'
  ]);

  function getFeatureConfig(value) {
    if (value == null) return {};
    if (typeof value !== 'object' || Array.isArray(value)) {
      throw bridgeError('invalid_editor_config', 'Config must be a JSON object.');
    }
    const unsupported = Object.keys(value).filter(key => !SUPPORTED_CONFIG_KEYS.has(key));
    if (unsupported.length) {
      throw bridgeError('invalid_editor_config',
        `Unsupported config keys: ${unsupported.join(', ')}. Use the widget options for toolbar, initial HTML, and license activation.`);
    }
    validateConfigValue(value, new Set());
    return value;
  }

  function validateConfigValue(value, ancestors) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
        (typeof value === 'number' && Number.isFinite(value))) return;
    if (typeof value !== 'object' || ancestors.has(value) ||
        (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype)) {
      throw bridgeError('invalid_editor_config', 'Config must contain only acyclic JSON values and finite numbers.');
    }
    ancestors.add(value);
    try {
      for (const key of Object.keys(value)) {
        if (key.includes('.') || ['__proto__', 'prototype', 'constructor'].includes(key)) {
          throw bridgeError('invalid_editor_config', 'Config keys cannot contain dots or prototype keys.');
        }
        validateConfigValue(value[key], ancestors);
      }
    } finally {
      ancestors.delete(value);
    }
  }

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
  let customStyle = null;

  function removeCustomStyle() {
    if (customStyle) customStyle.remove();
    customStyle = null;
  }

  function applyCustomCss(css) {
    if (css != null && typeof css !== 'string') {
      throw bridgeError('invalid_custom_css', 'customCss must be a string or null.');
    }
    removeCustomStyle();
    if (css == null || css === '') return;
    customStyle = document.createElement('style');
    customStyle.id = 'ckeditor-flutter-custom-css';
    // Keep CSS as text, including quotes and closing-tag-like sequences.
    // The stylesheet is outside the editable data and is never serialized.
    customStyle.textContent = css;
    document.head.appendChild(customStyle);
  }

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
      // Contextual balloons live outside editorElement, unlike toolbar menus.
      const captureGestures = !!editor.plugins.get('ContextualBalloon').visibleView ||
        !!editorElement.querySelector('[aria-expanded="true"]') ||
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
    if (autoHeight && editor) {
      editor.plugins.get('ContextualBalloon').off('change:visibleView', scheduleLayout);
    }
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
    editor.plugins.get('ContextualBalloon').on('change:visibleView', scheduleLayout);
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
      code: typeof error?.bridgeCode === 'string' && error.bridgeCode
        ? error.bridgeCode : fallbackCode,
      message: typeof error?.message === 'string' && error.message
        ? error.message : String(error)
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

  function getToolbarItems(items) {
    if (items == null) return [...TOOLBAR];
    if (!Array.isArray(items)) {
      throw bridgeError('invalid_toolbar_items', 'toolbarItems must be an array or null.');
    }
    const unsupported = items.filter(item =>
      typeof item !== 'string' || !SUPPORTED_TOOLBAR_ITEMS.has(item));
    if (unsupported.length) {
      throw bridgeError('invalid_toolbar_items',
        `Unsupported toolbar items: ${JSON.stringify(unsupported)}.`);
    }
    return [...items];
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
      const uiLanguage = options.uiLanguage ?? 'en';
      const licenseKey = options.licenseKey;
      const toolbarItems = getToolbarItems(options.toolbarItems);
      const featureConfig = getFeatureConfig(options.config);
      if (typeof initialHtml !== 'string' || typeof readOnly !== 'boolean' ||
          !Number.isInteger(debounceMs) || debounceMs < 0 ||
          typeof expand !== 'boolean' || !Number.isFinite(minHeight) || minHeight <= 0 ||
          typeof uiLanguage !== 'string') {
        throw bridgeError('invalid_argument', 'Invalid editor initialization options.');
      }
      if (licenseKey != null &&
          (typeof licenseKey !== 'string' || !licenseKey.trim())) {
        throw bridgeError('invalid_license_key', 'Supply a non-empty CKEditor license key.');
      }
      changeDebounceMs = debounceMs;
      autoHeight = expand;
      document.documentElement.classList.toggle('editor-auto-height', expand);
      document.documentElement.style.setProperty('--editor-min-height', `${minHeight}px`);
      // HTML goes through the CKEditor model; never assign it to innerHTML.
      const config = {
        ...featureConfig,
        initialData: initialHtml,
        language: { ui: uiLanguage, content: 'en' },
        plugins: PLUGINS.map(name => bundle[name]),
        toolbar: { items: toolbarItems, shouldNotGroupWhenFull: false }
      };
      // Modern installations receive translation objects through configuration.
      // The legacy default bundle continues using its global translation lookup.
      if (window.CKEDITOR_BUNDLE_INFO?.translationFormat === 'umd' &&
          window.CKEDITOR_TRANSLATIONS?.[uiLanguage]) {
        config.translations = {
          [uiLanguage]: window.CKEDITOR_TRANSLATIONS[uiLanguage]
        };
      }
      // Flutter supplies activation at runtime; generated assets store no key.
      if (licenseKey != null) {
        config.licenseKey = licenseKey;
      }
      applyCustomCss(options.customCss);
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
      // Link includes AutoLink upstream. Keep URL typing/paste behavior unchanged;
      // this integration exposes manual link editing through the link UI.
      if (instance.plugins.has('AutoLink')) {
        instance.plugins.get('AutoLink').forceDisabled('flutter-manual-links');
      }
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
      removeCustomStyle();
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
    removeCustomStyle();
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
