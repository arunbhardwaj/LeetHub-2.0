import { readFileSync } from 'node:fs';
import { createEmptyStats } from '../scripts/core/stats.js';
import {
  finalizeGfgRepositoryProblem,
  recordSuccessfulSync,
  recordSyncOutcome,
  reserveGfgRepositoryProblem,
  STORAGE_KEYS,
} from '../scripts/core/storage.js';
import { createSyncFeedback } from '../scripts/gfg/feedback.js';
import { createAcceptedSubmissionSync } from '../scripts/gfg/sync.js';

function memoryBrowser(initial = {}) {
  const values = structuredClone(initial);
  return {
    values,
    storage: {
      local: {
        async get(keys) {
          const requested = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            requested.filter(key => values[key] !== undefined).map(key => [key, values[key]])
          );
        },
        async set(next) {
          Object.assign(values, structuredClone(next));
        },
      },
    },
  };
}

describe('release readiness', () => {
  it('ships GFG-only manifests with minimal runtime permissions', () => {
    for (const filename of ['manifest-chrome.json', 'manifest-firefox.json']) {
      const source = readFileSync(filename, 'utf8');
      const manifest = JSON.parse(source);
      expect(manifest.name).toBe('GFGHub');
      expect(manifest.permissions).toEqual(['storage']);
      expect(manifest.host_permissions).toEqual(['https://api.github.com/*']);
      expect(source).not.toContain('leetcode.com');
      expect(source).not.toContain('practice.geeksforgeeks.org');
      expect(source).not.toContain('LEETCODE_SUBMISSION');
      expect(manifest.content_scripts.at(-1).matches).toEqual([
        'https://www.geeksforgeeks.org/problems/*',
        'https://geeksforgeeks.org/problems/*',
      ]);
    }
  });

  it('runs captured Accepted data through upload, stats, outcome, and feedback', async () => {
    const api = memoryBrowser({
      [STORAGE_KEYS.TOKEN]: 'token',
      [STORAGE_KEYS.REPOSITORY]: 'owner/gfg-solutions',
      [STORAGE_KEYS.MODE]: 'commit',
      [STORAGE_KEYS.STATS]: createEmptyStats(),
    });
    const files = new Map();
    const notifications = [];
    const sync = createAcceptedSubmissionSync({
      reserveProblem: problem => reserveGfgRepositoryProblem(problem, { api }),
      finalizeProblem: (problem, languages) =>
        finalizeGfgRepositoryProblem(problem, languages, { api }),
      prepareMigration: async () => ({
        copied: [],
        cleanup: async () => ({ status: 'not_found' }),
      }),
      async syncFile(content, directory, filename) {
        const path = [directory, filename].filter(Boolean).join('/');
        const action = files.has(path) ? 'updated' : 'created';
        files.set(path, content);
        return { action, sha: `${filename}-sha` };
      },
      recordSync: details => recordSuccessfulSync(details, { api }),
    });
    const feedback = createSyncFeedback({
      sync,
      notifier: {
        show: notification => notifications.push(notification),
        cleanup() {},
      },
      persist: outcome => recordSyncOutcome(outcome, { api }),
      now: () => 1234,
    });
    const acceptedSnapshot = {
      attemptId: 'binary-search/1:1',
      verdict: 'accepted',
      problem: {
        title: 'Binary Search',
        slug: 'binary-search',
        url: 'https://www.geeksforgeeks.org/problems/binary-search/1',
        difficulty: 'easy',
        statement: 'Find the target.',
      },
      solution: { code: 'Code A', language: 'java', extension: '.java' },
    };
    const editorAfterSubmit = 'Code B';

    const result = await feedback.handle(acceptedSnapshot);

    expect(result.status).toBe('synced');
    expect(files.get('0001-binary-search/Solution.java')).toBe('Code A');
    expect(files.get('0001-binary-search/Solution.java')).not.toBe(editorAfterSubmit);
    expect(files.get('0001-binary-search/README.md')).toContain('# Binary Search');
    expect(api.values.stats).toEqual(
      jasmine.objectContaining({ solved: 1, easy: 1, medium: 0, hard: 0 })
    );
    expect(api.values.last_sync_status.status).toBe('success');
    expect(notifications).toEqual([
      {
        type: 'success',
        heading: 'Synced to GitHub',
        detail: 'Binary Search • Java',
      },
    ]);
  });
});
