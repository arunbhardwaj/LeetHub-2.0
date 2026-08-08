import { EditorType, getEditorSnapshot } from '../scripts/gfg/editor.js';

function makeDocument({ editor, textarea, language }) {
  return {
    defaultView: null,
    querySelector(selector) {
      if (selector === '#ace-editor.ace_editor') return editor ?? null;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes('language_dropdown')) return language ? [language] : [];
      if (selector === 'textarea') return textarea ? [textarea] : [];
      return [];
    },
  };
}

describe('GFG editor snapshot extraction', () => {
  it('uses the full rendered Ace text layer only as a fallback', async () => {
    const documentObject = makeDocument({
      editor: {
        querySelector: () => ({ innerText: 'class Solution {\n  return true;\n}' }),
      },
      language: { innerText: 'C++ (17)' },
    });

    const snapshot = await getEditorSnapshot(documentObject, { timeoutMs: 5, now: () => 42 });

    expect(snapshot.editorType).toBe(EditorType.ACE);
    expect(snapshot.code).toContain('class Solution');
    expect(snapshot.language).toBe('cpp');
    expect(snapshot.extension).toBe('.cpp');
    expect(snapshot.capturedAt).toBe(42);
  });

  it('extracts a usable textarea and reports missing language separately', async () => {
    const documentObject = makeDocument({
      textarea: { value: 'print("hello")', matches: () => false },
    });
    const snapshot = await getEditorSnapshot(documentObject, { now: () => 43 });

    expect(snapshot.editorType).toBe(EditorType.TEXTAREA);
    expect(snapshot.code).toBe('print("hello")');
    expect(snapshot.language).toBeNull();
    expect(snapshot.captureError).toBe('language_not_detected');
  });

  it('reports editor failure without throwing', async () => {
    const documentObject = makeDocument({ language: { innerText: 'Java' } });
    const snapshot = await getEditorSnapshot(documentObject, { now: () => 44 });

    expect(snapshot.code).toBeNull();
    expect(snapshot.language).toBe('java');
    expect(snapshot.captureError).toBe('editor_not_found');
  });
});
