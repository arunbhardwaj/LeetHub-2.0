import { getBrowser, isEmptyObject } from '../leetcode/util.js';

export const REVISION_STORAGE_KEY = 'leethub_revision_data';

/**
 * Return default clean revision state
 */
export function getDefaultRevisionData() {
  return {
    version: 1,
    problems: {}, // problemSlug -> ProblemRecord
    submissions: [], // Array<SubmissionRecord>
    revisions: [], // Array<RevisionRecord>
    lastUpdated: null,
  };
}

/**
 * Safely resolves the extension storage API or null in test/mock environment
 */
export function resolveStorageApi(customApi) {
  if (customApi) return customApi;
  try {
    return getBrowser();
  } catch {
    if (typeof chrome !== 'undefined' && chrome.storage) return chrome;
    if (typeof browser !== 'undefined' && browser.storage) return browser;
    return null;
  }
}

/**
 * Convert a problem slug like "0001-two-sum" to "Two Sum"
 */
export function humanizeSlug(slug) {
  if (!slug) return 'Unknown Problem';
  const parts = slug.replace(/^\d+-/, '').split('-');
  return parts
    .map(p => (p ? p.charAt(0).toUpperCase() + p.slice(1) : ''))
    .join(' ');
}

/**
 * Extract question frontend ID from problem slug if not explicitly passed
 */
export function extractFrontendIdFromSlug(slug) {
  if (!slug) return '';
  const match = slug.match(/^(\d+)-/);
  return match ? parseInt(match[1], 10).toString() : '';
}

/**
 * Backfills revision problems from legacy `stats.shas`
 */
export function syncFromLegacyStats(legacyStats, revisionData) {
  if (!legacyStats || !legacyStats.shas || isEmptyObject(legacyStats.shas)) {
    return revisionData;
  }

  const updatedData = {
    ...revisionData,
    problems: { ...revisionData.problems },
  };

  for (const [slug, details] of Object.entries(legacyStats.shas)) {
    if (!updatedData.problems[slug]) {
      const difficulty = details.difficulty
        ? details.difficulty.charAt(0).toUpperCase() + details.difficulty.slice(1).toLowerCase()
        : 'Unknown';

      updatedData.problems[slug] = {
        problemSlug: slug,
        frontendId: extractFrontendIdFromSlug(slug),
        title: humanizeSlug(slug),
        difficulty,
        topicTags: [],
        firstSolvedAt: null,
        lastSolvedAt: null,
        lastRevisedAt: null,
        revisionCount: 0,
        failedAttempts: 0,
        totalSubmissions: 1,
        successCount: 1,
        importedFromLegacy: true,
        similarQuestions: [],
      };
    }
  }

  return updatedData;
}

/**
 * Retrieve revision tracker data from storage
 */
export async function getRevisionData(customApi) {
  const api = resolveStorageApi(customApi);
  if (!api || !api.storage || !api.storage.local) {
    return getDefaultRevisionData();
  }

  const result = await api.storage.local.get([REVISION_STORAGE_KEY, 'stats']);
  let revisionData = result[REVISION_STORAGE_KEY];

  if (!revisionData || typeof revisionData !== 'object') {
    revisionData = getDefaultRevisionData();
  }

  // Gracefully merge legacy solved problem shas if present
  if (result.stats && result.stats.shas) {
    revisionData = syncFromLegacyStats(result.stats, revisionData);
  }

  return revisionData;
}

/**
 * Persist revision tracker data to storage
 */
export async function saveRevisionData(data, customApi) {
  const api = resolveStorageApi(customApi);
  if (!api || !api.storage || !api.storage.local) {
    return false;
  }

  data.lastUpdated = Date.now();
  await api.storage.local.set({ [REVISION_STORAGE_KEY]: data });
  return true;
}

/**
 * Record a submission attempt (either Accepted or Failed)
 */
export async function recordSubmissionAttempt(attempt, customApi) {
  const {
    submissionId,
    problemSlug,
    frontendId,
    title,
    difficulty,
    topicTags = [],
    outcome, // 'Accepted' | 'Failed'
    statusCode,
    timestamp = Date.now(),
    runtimeDisplay = null,
    memoryDisplay = null,
    similarQuestions = [],
  } = attempt;

  if (!problemSlug) return null;

  const data = await getRevisionData(customApi);

  // Avoid recording identical submission ID twice
  if (submissionId && data.submissions.some(s => s.submissionId === submissionId)) {
    return data;
  }

  const isAccepted = outcome === 'Accepted' || statusCode === 10;
  const normalizedOutcome = isAccepted ? 'Accepted' : 'Failed';

  // Normalize difficulty
  const normDifficulty = difficulty
    ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()
    : 'Unknown';

  let problem = data.problems[problemSlug];
  if (!problem) {
    problem = {
      problemSlug,
      frontendId: frontendId || extractFrontendIdFromSlug(problemSlug),
      title: title || humanizeSlug(problemSlug),
      difficulty: normDifficulty,
      topicTags: Array.isArray(topicTags) ? topicTags : [],
      firstSolvedAt: isAccepted ? timestamp : null,
      lastSolvedAt: isAccepted ? timestamp : null,
      lastRevisedAt: null,
      revisionCount: 0,
      failedAttempts: isAccepted ? 0 : 1,
      totalSubmissions: 1,
      successCount: isAccepted ? 1 : 0,
      importedFromLegacy: false,
      similarQuestions: Array.isArray(similarQuestions) ? similarQuestions : [],
    };
  } else {
    problem.totalSubmissions = (problem.totalSubmissions || 0) + 1;
    if (frontendId && !problem.frontendId) problem.frontendId = frontendId;
    if (title && (!problem.title || problem.title === 'Unknown Problem')) problem.title = title;
    if (normDifficulty !== 'Unknown') problem.difficulty = normDifficulty;
    if (topicTags && topicTags.length > 0) problem.topicTags = topicTags;
    if (similarQuestions && similarQuestions.length > 0) problem.similarQuestions = similarQuestions;

    if (isAccepted) {
      problem.successCount = (problem.successCount || 0) + 1;
      if (!problem.firstSolvedAt) problem.firstSolvedAt = timestamp;
      problem.lastSolvedAt = timestamp;
    } else {
      problem.failedAttempts = (problem.failedAttempts || 0) + 1;
    }
  }

  data.problems[problemSlug] = problem;

  // Append to submission history (capping at 2000 recent submissions to safeguard storage)
  data.submissions.push({
    submissionId: submissionId || null,
    problemSlug,
    outcome: normalizedOutcome,
    statusCode: statusCode || (isAccepted ? 10 : 0),
    timestamp,
    runtimeDisplay,
    memoryDisplay,
  });

  if (data.submissions.length > 2000) {
    data.submissions = data.submissions.slice(-2000);
  }

  await saveRevisionData(data, customApi);
  return data;
}

/**
 * Record that the user revised a problem
 */
export async function recordProblemRevision(problemSlug, outcome = 'Completed', notes = '', customApi) {
  const data = await getRevisionData(customApi);
  const problem = data.problems[problemSlug];
  if (!problem) return null;

  const timestamp = Date.now();
  problem.lastRevisedAt = timestamp;
  problem.revisionCount = (problem.revisionCount || 0) + 1;

  data.revisions.push({
    problemSlug,
    timestamp,
    outcome,
    notes: notes || '',
  });

  if (data.revisions.length > 1000) {
    data.revisions = data.revisions.slice(-1000);
  }

  await saveRevisionData(data, customApi);
  return data;
}
