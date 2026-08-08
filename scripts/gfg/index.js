import { migrateLegacySyncStorage } from '../core/storage.js';
import { createEventBus, GfgEvent } from './events.js';
import { createSyncFeedback } from './feedback.js';
import { createMetadataMonitor } from './metadata.js';
import { createSyncNotifier } from './notification.js';
import { createRouteMonitor } from './router.js';
import { createSubmissionMonitor } from './submission.js';
import { Verdict } from './verdict.js';

const events = createEventBus();
const syncNotifier = createSyncNotifier(document);
const syncFeedback = createSyncFeedback({
  notifier: syncNotifier,
  onPersistenceError: () => {
    console.warn('[GFGHub] Could not save latest sync status');
  },
  onNotificationError: () => {
    console.warn('[GFGHub] Could not display sync status');
  },
});
let submissionSequence = 0;
let cleanupProblemPage = null;

events.on(GfgEvent.SUBMISSION_START, attempt => {
  if (attempt.captureError) {
    console.warn(`[GFGHub] source capture failed: ${attempt.captureError}`);
  }
});
events.on(GfgEvent.SUBMISSION_RESULT, attempt => {
  if (attempt.verdict !== Verdict.ACCEPTED) return;

  console.info(`[GFGHub] Sync requested: ${attempt.attemptId}`);
  console.info('[GFGHub] Starting GitHub sync');
  void syncFeedback.handle(attempt).then(result => {
    if (result.status === 'failed') {
      console.error(`[GFGHub] GitHub sync failed: ${result.reason}`);
      return;
    }
    console.info(`[GFGHub] Sync success: ${result.status}`);
  });
});

migrateLegacySyncStorage().catch(error => {
  console.error('[GFGHub] Legacy storage migration failed', error);
});

const stopRouteMonitor = createRouteMonitor(window, (routeKey, previousRouteKey) => {
  if (previousRouteKey) syncFeedback.cleanup();
  if (cleanupProblemPage) {
    cleanupProblemPage();
    cleanupProblemPage = null;
  }

  if (!routeKey) return;

  const metadataMonitor = createMetadataMonitor({
    document,
    location,
    routeKey,
  });
  const cleanupSubmission = createSubmissionMonitor({
    document,
    routeKey,
    nextSequence: () => ++submissionSequence,
    emit: events.emit,
    metadataSnapshot: metadataMonitor.getSnapshot,
  });
  cleanupProblemPage = () => {
    cleanupSubmission();
    metadataMonitor.cleanup();
  };
});

window.addEventListener(
  'pagehide',
  () => {
    stopRouteMonitor();
    syncFeedback.cleanup();
    cleanupProblemPage?.();
    cleanupProblemPage = null;
  },
  { once: true }
);
