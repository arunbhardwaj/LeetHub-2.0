import { GfgEvent } from '../scripts/gfg/events.js';
import { createSubmissionMonitor } from '../scripts/gfg/submission.js';

class FakeObserver {
  static instances = [];

  constructor(callback) {
    this.callback = callback;
    FakeObserver.instances.push(this);
  }

  observe() {}

  disconnect() {}
}

function createFakeDom() {
  const submitButton = {
    innerText: 'Submit',
    closest: () => submitButton,
  };
  const compileButton = {
    innerText: 'Compile & Run',
    closest: () => compileButton,
  };
  const resultContainer = {
    innerText: '',
    querySelectorAll: () => [],
  };
  const siblingResultContainer = {
    innerText: '',
    querySelectorAll: () => [],
  };
  const footer = {
    querySelectorAll: () => [compileButton, submitButton],
  };
  let clickListener;
  let documentObject;
  const codingPane = {
    matches: selector => selector === '#problem_right_section',
    ownerDocument: null,
    querySelector(selector) {
      if (selector === '#problem_right_section') return codingPane;
      if (selector === '#rightFooter') return footer;
      if (selector.includes('problems_output_window')) return resultContainer;
      return null;
    },
    querySelectorAll: selector => (selector === 'button' ? [compileButton, submitButton] : []),
  };
  documentObject = {
    querySelector: selector => (selector === '#problem_right_section' ? codingPane : null),
    querySelectorAll: selector =>
      selector.includes('problems_output_window') ? [resultContainer, siblingResultContainer] : [],
    addEventListener: (_type, listener) => {
      clickListener = listener;
    },
    removeEventListener: () => {
      clickListener = null;
    },
  };
  codingPane.ownerDocument = documentObject;

  return {
    documentObject,
    codingPane,
    compileButton,
    resultContainer,
    siblingResultContainer,
    submitButton,
    click() {
      clickListener({ target: submitButton });
    },
    compile() {
      clickListener({ target: compileButton });
    },
  };
}

const silentLogger = { info() {} };

describe('GFG submission snapshot association', () => {
  beforeEach(() => {
    FakeObserver.instances = [];
  });

  it('keeps the submitted code when the editor changes before the verdict', async () => {
    const dom = createFakeDom();
    const events = [];
    const cleanup = createSubmissionMonitor({
      document: dom.documentObject,
      routeKey: 'problem-a/1',
      nextSequence: () => 1,
      MutationObserverClass: FakeObserver,
      editorSnapshot: async () => ({
        code: 'Code A',
        language: 'java',
        extension: '.java',
        editorType: 'ace',
        captureError: null,
        capturedAt: 10,
      }),
      metadataSnapshot: () =>
        Object.freeze({
          title: 'Problem A',
          slug: 'problem-a',
          routeKey: 'problem-a/1',
          url: 'https://www.geeksforgeeks.org/problems/problem-a/1',
          difficulty: 'easy',
          statement: 'Problem A statement',
          metadataErrors: Object.freeze([]),
        }),
      now: () => 11,
      logger: silentLogger,
      emit: (type, detail) => events.push({ type, detail }),
    });

    await Promise.resolve();
    dom.click();
    await Promise.resolve();
    dom.resultContainer.innerText = 'Correct';
    FakeObserver.instances[0].callback();

    const result = events.find(event => event.type === GfgEvent.SUBMISSION_RESULT);
    expect(result.detail.code).toBe('Code A');
    expect(result.detail.language).toBe('java');
    expect(result.detail.extension).toBe('.java');
    expect(result.detail.verdict).toBe('accepted');
    expect(result.detail.snapshot.code).toBe('Code A');
    expect(result.detail.problem.title).toBe('Problem A');
    expect(result.detail.solution.code).toBe('Code A');
    expect(result.detail.title).toBe('Problem A');

    cleanup();
  });

  it('continues to emit a verdict when source capture fails', async () => {
    const dom = createFakeDom();
    const events = [];
    const cleanup = createSubmissionMonitor({
      document: dom.documentObject,
      routeKey: 'problem-a/1',
      nextSequence: () => 1,
      MutationObserverClass: FakeObserver,
      editorSnapshot: async () => ({
        code: null,
        language: null,
        extension: null,
        editorType: 'unknown',
        captureError: 'editor_not_found',
        capturedAt: 10,
      }),
      logger: silentLogger,
      emit: (type, detail) => events.push({ type, detail }),
    });

    await Promise.resolve();
    dom.click();
    await Promise.resolve();
    dom.resultContainer.innerText = 'Accepted';
    FakeObserver.instances[0].callback();

    const result = events.find(event => event.type === GfgEvent.SUBMISSION_RESULT);
    expect(result.detail.verdict).toBe('accepted');
    expect(result.detail.code).toBeNull();
    expect(result.detail.captureError).toBe('editor_not_found');

    cleanup();
  });

  it('detects the current verdict in a sibling GFG output panel', async () => {
    const dom = createFakeDom();
    const events = [];
    const cleanup = createSubmissionMonitor({
      document: dom.documentObject,
      routeKey: 'problem-a/1',
      nextSequence: () => 1,
      MutationObserverClass: FakeObserver,
      editorSnapshot: async () => ({
        code: 'Code A',
        language: 'java',
        extension: '.java',
      }),
      logger: silentLogger,
      emit: (type, detail) => events.push({ type, detail }),
    });

    await Promise.resolve();
    dom.click();
    await Promise.resolve();
    dom.siblingResultContainer.innerText = 'Correct';
    FakeObserver.instances[1].callback();

    const result = events.find(event => event.type === GfgEvent.SUBMISSION_RESULT);
    expect(result.detail.verdict).toBe('accepted');
    expect(result.detail.code).toBe('Code A');
    cleanup();
  });

  it('does not create an attempt for Compile & Run', async () => {
    const dom = createFakeDom();
    const events = [];
    const cleanup = createSubmissionMonitor({
      document: dom.documentObject,
      routeKey: 'problem-a/1',
      nextSequence: () => 1,
      MutationObserverClass: FakeObserver,
      editorSnapshot: async () => ({ code: 'Code A', language: 'java', extension: '.java' }),
      logger: silentLogger,
      emit: (type, detail) => events.push({ type, detail }),
    });

    await Promise.resolve();
    dom.compile();
    await Promise.resolve();

    expect(events).toEqual([]);
    cleanup();
  });

  it('does not create an attempt from an old Correct result without Submit', async () => {
    const dom = createFakeDom();
    dom.resultContainer.innerText = 'Correct';
    const events = [];
    const cleanup = createSubmissionMonitor({
      document: dom.documentObject,
      routeKey: 'problem-a/1',
      nextSequence: () => 1,
      MutationObserverClass: FakeObserver,
      editorSnapshot: async () => ({ code: 'Code A', language: 'java', extension: '.java' }),
      logger: silentLogger,
      emit: (type, detail) => events.push({ type, detail }),
    });

    await Promise.resolve();
    FakeObserver.instances[0].callback();

    expect(events).toEqual([]);
    cleanup();
  });
});
