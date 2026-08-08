import { createSyncFeedback, failureMessage } from '../scripts/gfg/feedback.js';

function submission(overrides = {}) {
  return {
    attemptId: overrides.attemptId ?? 'binary-search/1:1',
    verdict: overrides.verdict ?? 'accepted',
    problem: {
      title: overrides.title ?? 'Binary Search',
      slug: overrides.slug ?? 'binary-search',
    },
    solution: {
      language: overrides.language ?? 'java',
      code: 'captured code',
    },
  };
}

function fakeNotifier() {
  return {
    shown: [],
    cleanupCalls: 0,
    show(notification) {
      this.shown.push(notification);
    },
    cleanup() {
      this.cleanupCalls++;
      this.shown = [];
    },
  };
}

describe('GFG sync feedback', () => {
  it('shows success only after a confirmed GitHub sync and persists no source', async () => {
    const notifier = fakeNotifier();
    const outcomes = [];
    let resolveSync;
    const feedback = createSyncFeedback({
      sync: async () => new Promise(resolve => (resolveSync = resolve)),
      notifier,
      persist: async outcome => outcomes.push(outcome),
      now: () => 1234,
    });

    const operation = feedback.handle(submission());
    await Promise.resolve();
    expect(notifier.shown).toEqual([]);
    resolveSync({ status: 'synced', files: [] });
    await operation;

    expect(notifier.shown).toEqual([
      {
        type: 'success',
        heading: 'Synced to GitHub',
        detail: 'Binary Search • Java',
      },
    ]);
    expect(outcomes[0]).toEqual({
      title: 'Binary Search',
      slug: 'binary-search',
      language: 'java',
      status: 'success',
      reason: null,
      message: 'Synced to GitHub',
      syncedAt: 1234,
    });
    expect(JSON.stringify(outcomes[0])).not.toContain('captured code');
  });

  it('maps authentication, missing repository, and network failures to useful messages', async () => {
    expect(failureMessage('authentication_failed')).toBe(
      'GitHub authentication expired — connect again'
    );
    expect(failureMessage('repository_not_selected')).toBe('Select a repository in the extension');
    expect(failureMessage('network_failure')).toBe('Sync failed — check your connection');
    expect(failureMessage('permission_denied')).toBe('GitHub permission denied');
    expect(failureMessage('rate_limited')).toBe('GitHub rate limit reached — try again later');

    for (const reason of ['authentication_failed', 'repository_not_selected', 'network_failure']) {
      const notifier = fakeNotifier();
      const feedback = createSyncFeedback({
        sync: async () => ({ status: 'failed', reason, files: [] }),
        notifier,
        persist: async () => {},
      });
      await feedback.handle(submission({ attemptId: reason }));
      expect(notifier.shown[0]).toEqual({
        type: 'error',
        heading: failureMessage(reason),
        detail: 'Binary Search',
      });
    }
  });

  it('does not attempt sync or show GitHub feedback for failed GFG verdicts', async () => {
    let syncCalls = 0;
    const notifier = fakeNotifier();
    const feedback = createSyncFeedback({
      sync: async () => {
        syncCalls++;
      },
      notifier,
      persist: async () => {},
    });

    for (const verdict of [
      'wrong_answer',
      'compilation_error',
      'time_limit_exceeded',
      'runtime_error',
    ]) {
      await feedback.handle(submission({ attemptId: verdict, verdict }));
    }
    expect(syncCalls).toBe(0);
    expect(notifier.shown).toEqual([]);
  });

  it('produces one notification for duplicate delivery of an Accepted attempt', async () => {
    let syncCalls = 0;
    const notifier = fakeNotifier();
    const feedback = createSyncFeedback({
      sync: async () => {
        syncCalls++;
        return { status: 'unchanged', files: [] };
      },
      notifier,
      persist: async () => {},
    });
    const accepted = submission();
    const first = feedback.handle(accepted);
    const second = feedback.handle(accepted);

    expect(first).toBe(second);
    await Promise.all([first, second]);
    expect(syncCalls).toBe(1);
    expect(notifier.shown.length).toBe(1);
  });

  it('cleans the old toast and suppresses an in-flight result after SPA navigation', async () => {
    let resolveSync;
    const notifier = fakeNotifier();
    const feedback = createSyncFeedback({
      sync: async () => new Promise(resolve => (resolveSync = resolve)),
      notifier,
      persist: async () => {},
    });
    const operation = feedback.handle(submission());
    await Promise.resolve();

    feedback.cleanup();
    resolveSync({ status: 'synced', files: [] });
    await operation;
    expect(notifier.cleanupCalls).toBe(1);
    expect(notifier.shown).toEqual([]);
  });
});
