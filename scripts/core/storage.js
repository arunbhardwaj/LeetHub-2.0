import { getBrowser } from './browser.js';
import { createEmptyStats, recordSolvedProblem } from './stats.js';
import {
  finalizeRepositoryProblem,
  normalizeRepositoryIndex,
  reserveRepositoryProblem,
} from '../gfg/repository.js';

const STORAGE_KEYS = Object.freeze({
  TOKEN: 'leethub_token',
  USERNAME: 'leethub_username',
  REPOSITORY: 'leethub_hook',
  MODE: 'mode_type',
  STATS: 'stats',
  OAUTH_PIPE: 'pipe_leethub',
  LEGACY_SYNC_COMPLETE: 'isSync',
  LAST_SUCCESSFUL_SYNC: 'last_successful_sync',
  LAST_SYNC_STATUS: 'last_sync_status',
  GFG_REPOSITORY_INDEX: 'gfg_repository_index',
});

let storageWriteQueue = Promise.resolve();

function enqueueStorageWrite(operation) {
  const result = storageWriteQueue.then(operation);
  storageWriteQueue = result.catch(() => {});
  return result;
}

const LEGACY_SYNC_KEYS = [
  STORAGE_KEYS.TOKEN,
  STORAGE_KEYS.USERNAME,
  STORAGE_KEYS.OAUTH_PIPE,
  STORAGE_KEYS.STATS,
  STORAGE_KEYS.REPOSITORY,
  STORAGE_KEYS.MODE,
];

async function getStats(directory, api = getBrowser()) {
  let { stats } = await api.storage.local.get(STORAGE_KEYS.STATS);

  if (!stats || typeof stats !== 'object' || Object.keys(stats).length === 0) {
    stats = createEmptyStats();
  }

  stats.shas ??= {};
  stats.solvedSlugs ??= [];
  if (directory && !stats.shas[directory]) {
    stats.shas[directory] = {};
  }

  return stats;
}

async function setStats(stats, api = getBrowser()) {
  return api.storage.local.set({ [STORAGE_KEYS.STATS]: stats });
}

function updateStats(update, api = getBrowser()) {
  return enqueueStorageWrite(async () => {
    const stats = await getStats(undefined, api);
    const nextStats = await update(stats);
    await setStats(nextStats, api);
    return nextStats;
  });
}

async function getGfgRepositoryIndex(api = getBrowser()) {
  const values = await api.storage.local.get(STORAGE_KEYS.GFG_REPOSITORY_INDEX);
  return normalizeRepositoryIndex(values[STORAGE_KEYS.GFG_REPOSITORY_INDEX]);
}

function reserveGfgRepositoryProblem(problem, options = {}) {
  const api = options.api ?? getBrowser();
  return enqueueStorageWrite(async () => {
    const current = await getGfgRepositoryIndex(api);
    const reserved = reserveRepositoryProblem(current, problem);
    await api.storage.local.set({ [STORAGE_KEYS.GFG_REPOSITORY_INDEX]: reserved.index });
    return reserved;
  });
}

function finalizeGfgRepositoryProblem(problem, languages, options = {}) {
  const api = options.api ?? getBrowser();
  return enqueueStorageWrite(async () => {
    const current = await getGfgRepositoryIndex(api);
    const finalized = finalizeRepositoryProblem(current, problem, languages);
    await api.storage.local.set({ [STORAGE_KEYS.GFG_REPOSITORY_INDEX]: finalized.index });
    return finalized;
  });
}

function recordSuccessfulSync({ title, slug, language, difficulty, syncedAt }, options = {}) {
  const api = options.api ?? getBrowser();
  const now = options.now ?? Date.now;

  return enqueueStorageWrite(async () => {
    const [stats, connection] = await Promise.all([
      getStats(undefined, api),
      api.storage.local.get(STORAGE_KEYS.REPOSITORY),
    ]);
    const recorded = recordSolvedProblem(stats, slug, difficulty);
    const lastSuccessfulSync = {
      title,
      slug,
      language,
      repository: connection[STORAGE_KEYS.REPOSITORY] ?? null,
      syncedAt: syncedAt ?? now(),
    };

    await api.storage.local.set({
      [STORAGE_KEYS.STATS]: recorded.stats,
      [STORAGE_KEYS.LAST_SUCCESSFUL_SYNC]: lastSuccessfulSync,
    });

    return { ...recorded, lastSuccessfulSync };
  });
}

function recordSyncOutcome(outcome, options = {}) {
  const api = options.api ?? getBrowser();
  return enqueueStorageWrite(async () => {
    const connection = await api.storage.local.get(STORAGE_KEYS.REPOSITORY);
    const storedOutcome = {
      title: outcome.title ?? null,
      slug: outcome.slug ?? null,
      language: outcome.language ?? null,
      repository: connection[STORAGE_KEYS.REPOSITORY] ?? null,
      status: outcome.status,
      reason: outcome.reason ?? null,
      message: outcome.message,
      syncedAt: outcome.syncedAt,
    };
    await api.storage.local.set({ [STORAGE_KEYS.LAST_SYNC_STATUS]: storedOutcome });
    return storedOutcome;
  });
}

function resetGfgStats(options = {}) {
  const api = options.api ?? getBrowser();
  return enqueueStorageWrite(async () => {
    const current = await getStats(undefined, api);
    const stats = { ...createEmptyStats(), shas: current.shas };
    await api.storage.local.set({
      [STORAGE_KEYS.STATS]: stats,
      [STORAGE_KEYS.LAST_SUCCESSFUL_SYNC]: null,
      [STORAGE_KEYS.LAST_SYNC_STATUS]: null,
    });
    return stats;
  });
}

async function getGitHubConnection() {
  const api = getBrowser();
  const values = await api.storage.local.get([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.REPOSITORY,
    STORAGE_KEYS.MODE,
    STORAGE_KEYS.STATS,
  ]);

  return {
    token: values[STORAGE_KEYS.TOKEN],
    repository: values[STORAGE_KEYS.REPOSITORY],
    mode: values[STORAGE_KEYS.MODE],
    stats: values[STORAGE_KEYS.STATS],
  };
}

async function migrateLegacySyncStorage() {
  const api = getBrowser();
  const localValues = await api.storage.local.get([
    STORAGE_KEYS.LEGACY_SYNC_COMPLETE,
    ...LEGACY_SYNC_KEYS,
  ]);

  if (localValues[STORAGE_KEYS.LEGACY_SYNC_COMPLETE]) {
    return false;
  }

  for (const key of LEGACY_SYNC_KEYS) {
    if (localValues[key] !== undefined) {
      continue;
    }

    const syncValue = await api.storage.sync.get(key);
    if (syncValue[key] !== undefined) {
      await api.storage.local.set({ [key]: syncValue[key] });
    }
  }

  await api.storage.local.set({ [STORAGE_KEYS.LEGACY_SYNC_COMPLETE]: true });
  return true;
}

export {
  finalizeGfgRepositoryProblem,
  getGfgRepositoryIndex,
  getGitHubConnection,
  getStats,
  migrateLegacySyncStorage,
  recordSuccessfulSync,
  recordSyncOutcome,
  reserveGfgRepositoryProblem,
  resetGfgStats,
  setStats,
  STORAGE_KEYS,
  updateStats,
};
