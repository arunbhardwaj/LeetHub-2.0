import { recordSyncOutcome } from '../core/storage.js';
import { syncAcceptedSubmission } from './sync.js';
import { Verdict } from './verdict.js';

const FAILURE_MESSAGES = Object.freeze({
  github_not_authenticated: 'GitHub connection required',
  github_not_connected: 'GitHub connection required',
  repository_not_selected: 'Select a repository in the extension',
  authentication_failed: 'GitHub authentication expired — connect again',
  permission_denied: 'GitHub permission denied',
  rate_limited: 'GitHub rate limit reached — try again later',
  repository_not_found: 'Repository not found — select another repository',
  network_failure: 'Sync failed — check your connection',
  source_code_missing: 'Sync failed — captured solution unavailable',
  unsupported_extension: 'Sync failed — language is not supported',
  conflict: 'GitHub API conflict — try again',
  validation_failed: 'GitHub rejected the sync request',
  github_sync_failed: 'GitHub API failure — try again',
});

function displayLanguage(language) {
  const value = String(language?.normalized ?? language ?? '').trim();
  if (!value) return 'Unknown';
  if (value === 'cpp') return 'C++';
  if (value === 'csharp') return 'C#';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function failureMessage(reason) {
  return FAILURE_MESSAGES[reason] ?? 'GitHub API failure — try again';
}

function submissionDetails(submission) {
  return {
    title: submission?.problem?.title ?? submission?.title ?? 'GFG problem',
    slug: submission?.problem?.slug ?? submission?.slug ?? null,
    language: submission?.solution?.language ?? submission?.language ?? null,
  };
}

function createSyncFeedback({
  sync = syncAcceptedSubmission,
  notifier,
  persist = recordSyncOutcome,
  now = Date.now,
  onPersistenceError = () => {},
  onNotificationError = () => {},
} = {}) {
  const attempts = new Map();
  let pageGeneration = 0;

  const handle = submission => {
    if (submission?.verdict !== Verdict.ACCEPTED) {
      return Promise.resolve({ status: 'skipped', reason: 'verdict_not_accepted' });
    }

    const attemptId = submission.attemptId;
    if (attemptId && attempts.has(attemptId)) return attempts.get(attemptId);
    const generation = pageGeneration;

    const operation = (async () => {
      const result = await sync(submission);
      const details = submissionDetails(submission);
      const language = details.language?.normalized ?? details.language;
      const successful = result.status === 'synced' || result.status === 'unchanged';
      const message = successful ? 'Synced to GitHub' : failureMessage(result.reason);
      const outcome = {
        ...details,
        language,
        status: successful ? 'success' : 'failed',
        reason: successful ? null : result.reason,
        message,
        syncedAt: now(),
      };

      try {
        await persist(outcome);
      } catch (error) {
        onPersistenceError(error);
      }

      if (generation === pageGeneration) {
        try {
          notifier?.show({
            type: successful ? 'success' : 'error',
            heading: message,
            detail: successful ? `${details.title} • ${displayLanguage(language)}` : details.title,
          });
        } catch (error) {
          onNotificationError(error);
        }
      }
      return result;
    })();

    if (attemptId) attempts.set(attemptId, operation);
    return operation;
  };

  const cleanup = () => {
    pageGeneration++;
    try {
      notifier?.cleanup();
    } catch (error) {
      onNotificationError(error);
    }
  };

  return Object.freeze({ cleanup, handle });
}

export { createSyncFeedback, displayLanguage, failureMessage, FAILURE_MESSAGES };
