export const selectors = Object.freeze({
  codingPane: '#problem_right_section',
  editorFooter: '#rightFooter',
  resultPanelFallback: '[class*="problems_output_window__"]',
  resultPanelContainer: '.ui.segment.ui.overlay.bottom.sidebar',
});

function normalizedText(element) {
  return (element?.innerText ?? element?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function findCodingPane(documentObject) {
  return documentObject.querySelector(selectors.codingPane);
}

export function findSubmitButton(root) {
  const codingPane = root.matches?.(selectors.codingPane)
    ? root
    : root.querySelector(selectors.codingPane);
  if (!codingPane) return null;

  const footer = codingPane.querySelector(selectors.editorFooter);
  const footerMatches = footer
    ? [...footer.querySelectorAll('button')].filter(button => normalizedText(button) === 'Submit')
    : [];
  if (footerMatches.length === 1) return footerMatches[0];

  const buttons = [...codingPane.querySelectorAll('button')];
  const hasRunControl = buttons.some(button => normalizedText(button) === 'Compile & Run');
  const submitMatches = buttons.filter(button => normalizedText(button) === 'Submit');

  return hasRunControl && submitMatches.length === 1 ? submitMatches[0] : null;
}

export function findResultContainer(root) {
  return findResultContainers(root)[0] ?? null;
}

export function findResultContainers(root) {
  const codingPane = root.matches?.(selectors.codingPane)
    ? root
    : root.querySelector(selectors.codingPane);
  if (!codingPane) return [];

  const documentObject = codingPane.ownerDocument ?? root;
  const candidates = [
    ...documentObject.querySelectorAll(selectors.resultPanelContainer),
    ...documentObject.querySelectorAll(selectors.resultPanelFallback),
  ];
  const uniqueCandidates = [...new Set(candidates)];

  const semanticContainers = uniqueCandidates.filter(
    container =>
      normalizedText(container).startsWith('Output Window') ||
      [...container.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')].some(
        element => normalizedText(element) === 'Output Window'
      )
  );

  return semanticContainers.length > 0 ? semanticContainers : uniqueCandidates;
}

export function waitForCodingPane(
  documentObject,
  { timeoutMs = 15000, MutationObserverClass = MutationObserver } = {}
) {
  let observer;
  let timeoutId;
  let settled = false;
  let finish;

  const promise = new Promise(resolve => {
    finish = element => {
      if (settled) return;
      settled = true;
      observer?.disconnect();
      clearTimeout(timeoutId);
      resolve(element);
    };

    const existing = findCodingPane(documentObject);
    if (existing) {
      finish(existing);
      return;
    }

    observer = new MutationObserverClass(() => {
      const element = findCodingPane(documentObject);
      if (element) finish(element);
    });
    observer.observe(documentObject.documentElement, {
      childList: true,
      subtree: true,
    });
    timeoutId = setTimeout(() => finish(null), timeoutMs);
  });

  return {
    promise,
    cancel() {
      finish(null);
    },
  };
}
