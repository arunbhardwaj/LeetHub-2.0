import { createEmptyStats, recordSolvedProblem } from '../scripts/core/stats.js';
import {
  finalizeGfgRepositoryProblem,
  getGfgRepositoryIndex,
  recordSuccessfulSync,
  recordSyncOutcome,
  reserveGfgRepositoryProblem,
  resetGfgStats,
  STORAGE_KEYS,
} from '../scripts/core/storage.js';
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

function acceptedSubmission(overrides = {}) {
  return {
    attemptId: overrides.attemptId ?? 'binary-search/1:1',
    verdict: overrides.verdict ?? 'accepted',
    problem: {
      title: overrides.title ?? 'Binary Search',
      slug: overrides.slug ?? 'binary-search',
      url: `https://www.geeksforgeeks.org/problems/${overrides.slug ?? 'binary-search'}/1`,
      difficulty: overrides.difficulty ?? 'easy',
    },
    solution: {
      code: 'class Solution {}',
      language: overrides.language ?? 'java',
      extension: overrides.extension ?? '.java',
    },
  };
}

function repositoryOptions(api) {
  return {
    reserveProblem: problem => reserveGfgRepositoryProblem(problem, { api }),
    finalizeProblem: (problem, languages) =>
      finalizeGfgRepositoryProblem(problem, languages, { api }),
    prepareMigration: async () => ({
      copied: [],
      cleanup: async () => ({ status: 'not_found' }),
    }),
  };
}

describe('GFG successful-sync statistics', () => {
  it('counts unique slugs and only recognized difficulties', () => {
    let result = recordSolvedProblem(createEmptyStats(), 'problem-a', 'easy');
    expect(result.stats).toEqual(
      jasmine.objectContaining({ solved: 1, easy: 1, medium: 0, hard: 0 })
    );

    result = recordSolvedProblem(result.stats, 'problem-a', 'hard');
    expect(result.isNew).toBeFalse();
    expect(result.stats).toEqual(
      jasmine.objectContaining({ solved: 1, easy: 1, medium: 0, hard: 0 })
    );

    result = recordSolvedProblem(result.stats, 'problem-b', 'basic');
    expect(result.stats).toEqual(
      jasmine.objectContaining({ solved: 2, easy: 1, medium: 0, hard: 0 })
    );
  });

  it('updates persisted stats and last sync only after both GitHub files succeed', async () => {
    const api = memoryBrowser({
      [STORAGE_KEYS.REPOSITORY]: 'owner/gfg-solutions',
      [STORAGE_KEYS.STATS]: createEmptyStats(),
    });
    let fileCalls = 0;
    const sync = createAcceptedSubmissionSync({
      ...repositoryOptions(api),
      async syncFile() {
        fileCalls++;
        return { action: 'created', sha: `sha-${fileCalls}` };
      },
      recordSync: details => recordSuccessfulSync(details, { api, now: () => 1234 }),
    });

    const result = await sync(acceptedSubmission());
    expect(result.status).toBe('synced');
    expect(api.values.stats.solved).toBe(1);
    expect(api.values.stats.easy).toBe(1);
    expect(api.values.last_successful_sync).toEqual({
      title: 'Binary Search',
      slug: 'binary-search',
      language: 'java',
      repository: 'owner/gfg-solutions',
      syncedAt: jasmine.any(Number),
    });
  });

  it('does not record rejected verdicts or GitHub failures', async () => {
    const records = [];
    const recordSync = async details => records.push(details);
    const rejected = createAcceptedSubmissionSync({ recordSync });
    await rejected(acceptedSubmission({ verdict: 'wrong_answer' }));

    const failedApi = memoryBrowser();
    const failed = createAcceptedSubmissionSync({
      ...repositoryOptions(failedApi),
      async syncFile() {
        throw new Error('GitHub unavailable');
      },
      recordSync,
    });
    await failed(acceptedSubmission({ attemptId: 'binary-search/1:2' }));
    expect(records).toEqual([]);
  });

  it('deduplicates repeated attempts, problems, and languages but records new slugs', async () => {
    const api = memoryBrowser({ [STORAGE_KEYS.STATS]: createEmptyStats() });
    let fileCalls = 0;
    const sync = createAcceptedSubmissionSync({
      ...repositoryOptions(api),
      async syncFile() {
        fileCalls++;
        return { action: 'unchanged', sha: 'sha' };
      },
      recordSync: details => recordSuccessfulSync(details, { api }),
    });
    const first = acceptedSubmission();

    await Promise.all([sync(first), sync(first)]);
    await sync(
      acceptedSubmission({ attemptId: 'binary-search/1:2', language: 'cpp', extension: '.cpp' })
    );
    await sync(
      acceptedSubmission({
        attemptId: 'merge-sort/1:3',
        title: 'Merge Sort',
        slug: 'merge-sort',
        difficulty: 'hard',
      })
    );

    expect(fileCalls).toBe(9);
    expect(api.values.stats).toEqual(
      jasmine.objectContaining({ solved: 2, easy: 1, medium: 0, hard: 1 })
    );
    expect(api.values.stats.solvedSlugs).toEqual(['binary-search', 'merge-sort']);
  });

  it('survives later reads and resets only local GFG statistics', async () => {
    const api = memoryBrowser({
      [STORAGE_KEYS.TOKEN]: 'token',
      [STORAGE_KEYS.REPOSITORY]: 'owner/repository',
      [STORAGE_KEYS.STATS]: {
        ...createEmptyStats(),
        shas: { problem: { 'Solution.java': 'sha' } },
      },
    });
    await recordSuccessfulSync(
      {
        title: 'Problem',
        slug: 'problem',
        language: 'java',
        difficulty: 'medium',
      },
      { api }
    );
    expect(api.values.stats.solved).toBe(1);
    expect(api.values.stats.medium).toBe(1);

    await recordSyncOutcome(
      {
        title: 'Problem',
        slug: 'problem',
        language: 'java',
        status: 'failed',
        reason: 'network_failure',
        message: 'Sync failed — check your connection',
        syncedAt: 1234,
        code: 'must not be stored',
      },
      { api }
    );
    expect(api.values.last_sync_status).toEqual({
      title: 'Problem',
      slug: 'problem',
      language: 'java',
      repository: 'owner/repository',
      status: 'failed',
      reason: 'network_failure',
      message: 'Sync failed — check your connection',
      syncedAt: 1234,
    });
    expect(JSON.stringify(api.values.last_sync_status)).not.toContain('must not be stored');

    await resetGfgStats({ api });
    expect(api.values.stats).toEqual({
      ...createEmptyStats(),
      shas: { problem: { 'Solution.java': 'sha' } },
    });
    expect(api.values.last_successful_sync).toBeNull();
    expect(api.values.last_sync_status).toBeNull();
    expect(api.values[STORAGE_KEYS.TOKEN]).toBe('token');
    expect(api.values[STORAGE_KEYS.REPOSITORY]).toBe('owner/repository');
  });

  it('keeps the repository numbering map when local statistics are reset', async () => {
    const api = memoryBrowser({ [STORAGE_KEYS.STATS]: createEmptyStats() });
    const first = await reserveGfgRepositoryProblem({ slug: 'who-will-win-1587115621' }, { api });
    await resetGfgStats({ api });
    const repeated = await reserveGfgRepositoryProblem(
      { slug: 'who-will-win-1587115621' },
      { api }
    );
    const index = await getGfgRepositoryIndex(api);

    expect(first.entry.directory).toBe('0001-who-will-win');
    expect(repeated.entry.directory).toBe('0001-who-will-win');
    expect(index.nextNumber).toBe(2);
  });
});
