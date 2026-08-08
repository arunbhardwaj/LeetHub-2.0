import { normalizeLanguage } from '../core/languages.js';

export const EditorType = Object.freeze({
  ACE: 'ace',
  TEXTAREA: 'textarea',
  UNKNOWN: 'unknown',
});

const ACE_EDITOR_SELECTOR = '#ace-editor.ace_editor';
const ACE_TEXT_LAYER_SELECTOR = '.ace_text-layer';
const LANGUAGE_SELECTOR =
  '[role="listbox"].problems_language_dropdown__DgjFb, [role="listbox"][class*="language_dropdown"]';
const REQUEST_EVENT = 'gfghub:editor-request';
const RESPONSE_EVENT = 'gfghub:editor-response';
const BRIDGE_MARKER = '__gfghubAceBridgeInstalled';
let requestSequence = 0;

const BRIDGE_SOURCE = `(() => {
  if (window.${BRIDGE_MARKER}) return;
  window.${BRIDGE_MARKER} = true;
  window.addEventListener('${REQUEST_EVENT}', event => {
    const detail = event.detail || {};
    if (!detail.requestId || detail.editorId !== 'ace-editor') return;
    let code = null;
    let editorAvailable = false;
    try {
      const editor = window.ace && window.ace.edit(detail.editorId);
      editorAvailable = Boolean(editor);
      code = editor && typeof editor.getValue === 'function' ? editor.getValue() : null;
    } catch (_error) {
      code = null;
    }
    window.dispatchEvent(new CustomEvent('${RESPONSE_EVENT}', {
      detail: {
        requestId: detail.requestId,
        editorAvailable,
        code: typeof code === 'string' ? code : null
      }
    }));
  });
})()`;

function normalizedText(element) {
  return (element?.innerText ?? element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function getSelectedLanguageElement(documentObject) {
  const candidates = [...documentObject.querySelectorAll(LANGUAGE_SELECTOR)];
  return candidates.length === 1 ? candidates[0] : null;
}

export function getSelectedLanguage(documentObject) {
  const element = getSelectedLanguageElement(documentObject);
  const displayName = normalizedText(element);
  return normalizeLanguage(displayName);
}

export function detectEditorType(documentObject) {
  if (documentObject.querySelector(ACE_EDITOR_SELECTOR)) return EditorType.ACE;

  const textareas = [...documentObject.querySelectorAll('textarea')].filter(
    textarea => !textarea.matches('.g-recaptcha-response')
  );
  if (textareas.length === 1 && textareas[0].value.trim()) return EditorType.TEXTAREA;
  return EditorType.UNKNOWN;
}

function getTextareaCode(documentObject) {
  const textareas = [...documentObject.querySelectorAll('textarea')].filter(
    textarea => !textarea.matches('.g-recaptcha-response')
  );
  const candidate = textareas.find(textarea => textarea.value.trim());
  return candidate?.value ?? null;
}

function getRenderedAceCode(documentObject) {
  const editor = documentObject.querySelector(ACE_EDITOR_SELECTOR);
  const textLayer = editor?.querySelector(ACE_TEXT_LAYER_SELECTOR);
  const code = textLayer?.innerText ?? '';
  return code.trim() ? code : null;
}

function installAceBridge(documentObject) {
  if (documentObject.defaultView?.[BRIDGE_MARKER]) return;

  const script = documentObject.createElement('script');
  script.textContent = BRIDGE_SOURCE;
  (documentObject.documentElement || documentObject.head).appendChild(script);
  script.remove();
}

function requestAceCode(documentObject, timeoutMs) {
  const windowObject = documentObject.defaultView;
  if (!windowObject) return Promise.resolve({ code: null, editorAvailable: false });

  installAceBridge(documentObject);
  const requestId = `snapshot-${++requestSequence}`;

  return new Promise(resolve => {
    let settled = false;
    const finish = result => {
      if (settled) return;
      settled = true;
      windowObject.removeEventListener(RESPONSE_EVENT, handleResponse);
      clearTimeout(timeoutId);
      resolve(result);
    };
    const handleResponse = event => {
      const detail = event.detail;
      if (!detail || detail.requestId !== requestId) return;
      finish(detail);
    };
    const timeoutId = setTimeout(() => finish({ code: null, editorAvailable: false }), timeoutMs);

    windowObject.addEventListener(RESPONSE_EVENT, handleResponse);
    windowObject.dispatchEvent(
      new windowObject.CustomEvent(REQUEST_EVENT, {
        detail: { requestId, editorId: 'ace-editor' },
      })
    );
  });
}

export async function getEditorSnapshot(documentObject, { timeoutMs = 500, now = Date.now } = {}) {
  const editorType = detectEditorType(documentObject);
  const language = getSelectedLanguage(documentObject);
  let code = null;
  let captureError = null;

  if (editorType === EditorType.ACE) {
    const bridgeResult = await requestAceCode(documentObject, timeoutMs);
    code = bridgeResult.code;
    if (typeof code !== 'string' || !code.trim()) {
      code = getRenderedAceCode(documentObject);
      captureError = code ? 'ace_bridge_unavailable_rendered_fallback' : 'editor_not_found';
    }
  } else if (editorType === EditorType.TEXTAREA) {
    code = getTextareaCode(documentObject);
    if (!code) captureError = 'editor_not_found';
  } else {
    captureError = 'editor_not_found';
  }

  if (!language) captureError ??= 'language_not_detected';

  return Object.freeze({
    code: code ?? null,
    language: language?.normalized ?? null,
    displayLanguage: language?.displayName ?? null,
    extension: language?.extension ?? null,
    editorType,
    captureError,
    capturedAt: now(),
  });
}
