import { GfgEvent } from './events.js';
import { getEditorSnapshot } from './editor.js';
import { findResultContainers, findSubmitButton, waitForCodingPane } from './selectors.js';
import { SubmissionPhase, SubmissionTracker } from './state.js';
import { detectVerdict, isJudgingStatus } from './verdict.js';

export function createSubmissionMonitor({
  document: documentObject,
  routeKey,
  nextSequence,
  emit,
  now = Date.now,
  MutationObserverClass = MutationObserver,
  editorSnapshot = getEditorSnapshot,
  metadataSnapshot = () => null,
  logger = console,
}) {
  const tracker = new SubmissionTracker(routeKey, nextSequence, now);
  const codingPaneWaiter = waitForCodingPane(documentObject, {
    MutationObserverClass,
  });
  let codingPane = null;
  let paneObserver = null;
  const resultObservers = new Map();
  const baselineResultTexts = new Map();
  let attemptStarting = false;
  let destroyed = false;

  const textOf = element => (element?.innerText ?? element?.textContent ?? '').trim();

  const startAttempt = async source => {
    if (destroyed || attemptStarting) return null;
    if (
      tracker.current &&
      ![SubmissionPhase.COMPLETED, SubmissionPhase.CANCELLED].includes(tracker.current.phase)
    ) {
      return null;
    }

    attemptStarting = true;
    baselineResultTexts.clear();
    for (const container of resultObservers.keys()) {
      baselineResultTexts.set(container, textOf(container));
    }
    let solutionSnapshot;
    try {
      solutionSnapshot = await editorSnapshot(documentObject, { now });
    } catch (_error) {
      solutionSnapshot = {
        code: null,
        language: null,
        displayLanguage: null,
        extension: null,
        editorType: 'unknown',
        captureError: 'editor_capture_failed',
        capturedAt: now(),
      };
    }
    if (destroyed) {
      attemptStarting = false;
      return null;
    }

    let problem = null;
    try {
      problem = metadataSnapshot();
    } catch (_error) {
      problem = null;
    }
    const snapshot = {
      ...solutionSnapshot,
      problem,
    };
    logger.info('[GFGHub] Snapshot captured', {
      language: solutionSnapshot.language ?? null,
      extension: solutionSnapshot.extension ?? null,
      problemSlug: problem?.slug ?? null,
      captureError: solutionSnapshot.captureError ?? null,
    });
    const attempt = tracker.start(source, snapshot);
    logger.info(`[GFGHub] Attempt created: ${attempt.attemptId}`);
    attemptStarting = false;
    emit(GfgEvent.SUBMISSION_START, attempt);
    return attempt;
  };

  const inspectResult = (resultContainer, changedForCurrentAttempt = false) => {
    if (destroyed || !resultContainer) return;

    const text = textOf(resultContainer);
    const detected = detectVerdict(text);
    const verdict = detected?.verdict ?? null;
    const judging = isJudgingStatus(text);

    const hasActiveAttempt =
      tracker.current &&
      ![SubmissionPhase.COMPLETED, SubmissionPhase.CANCELLED].includes(tracker.current.phase);

    if (!hasActiveAttempt) return;

    if (judging) {
      const attempt = tracker.markJudging();
      if (attempt) emit(GfgEvent.SUBMISSION_JUDGING, attempt);
    }

    if (!verdict || !tracker.current) return;

    const isUnchangedStaleResult =
      !changedForCurrentAttempt &&
      text === baselineResultTexts.get(resultContainer) &&
      tracker.current.phase === SubmissionPhase.SUBMITTED;
    if (isUnchangedStaleResult) return;

    logger.info(`[GFGHub] Final verdict: ${detected.signal}`);
    logger.info(`[GFGHub] Normalized verdict: ${verdict}`);
    const attempt = tracker.complete(verdict);
    if (attempt) {
      baselineResultTexts.set(resultContainer, text);
      emit(GfgEvent.SUBMISSION_RESULT, attempt);
    }
  };

  const observeResultContainers = () => {
    const containers = findResultContainers(documentObject);
    for (const container of containers) {
      if (resultObservers.has(container)) continue;
      const discoveredDuringAttempt = Boolean(
        tracker.current &&
          ![SubmissionPhase.COMPLETED, SubmissionPhase.CANCELLED].includes(tracker.current.phase)
      );
      baselineResultTexts.set(container, textOf(container));
      const observer = new MutationObserverClass(() => inspectResult(container, true));
      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });
      resultObservers.set(container, observer);
      if (discoveredDuringAttempt) inspectResult(container, true);
    }
  };

  const handleClick = event => {
    const clickedButton = event.target?.closest?.('button');
    if (!clickedButton || clickedButton !== findSubmitButton(documentObject)) return;

    logger.info('[GFGHub] Submit detected');
    void startAttempt('button');
  };

  codingPaneWaiter.promise.then(element => {
    if (destroyed || !element) return;

    codingPane = element;
    documentObject.addEventListener('click', handleClick, true);
    observeResultContainers();

    paneObserver = new MutationObserverClass(observeResultContainers);
    paneObserver.observe(documentObject.documentElement ?? codingPane, {
      childList: true,
      subtree: true,
    });
  });

  return () => {
    if (destroyed) return;
    destroyed = true;
    codingPaneWaiter.cancel();
    documentObject.removeEventListener?.('click', handleClick, true);
    paneObserver?.disconnect();
    for (const observer of resultObservers.values()) observer.disconnect();
    resultObservers.clear();
    tracker.cancel();
  };
}
