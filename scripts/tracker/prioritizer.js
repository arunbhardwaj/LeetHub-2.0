import { detectDsaPatterns } from './patternDetection.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Spaced repetition interval schedules (in days)
 */
export function getTargetIntervalDays(revisionCount = 0) {
  if (revisionCount === 0) return 3; // First review in 3 days
  if (revisionCount === 1) return 7; // Second review in 1 week
  if (revisionCount === 2) return 16; // Third review in ~2 weeks
  return 35; // Mastered review in ~5 weeks
}

/**
 * Calculate dynamic revision priority for a single problem
 */
export function calculateProblemPriority(problem, weakTopicsSet = new Set(), now = Date.now()) {
  const lastActiveTimestamp = problem.lastRevisedAt || problem.lastSolvedAt;
  const hasTimestamp = typeof lastActiveTimestamp === 'number' && lastActiveTimestamp > 0;

  const revisionCount = problem.revisionCount || 0;
  const targetIntervalDays = getTargetIntervalDays(revisionCount);

  let elapsedDays = null;
  let urgencyFactor = 1.0;
  const factorExplanations = [];

  if (hasTimestamp) {
    elapsedDays = Math.max(0, Math.floor((now - lastActiveTimestamp) / MS_PER_DAY));
    urgencyFactor = elapsedDays / targetIntervalDays;

    if (elapsedDays >= targetIntervalDays) {
      const overdue = elapsedDays - targetIntervalDays;
      factorExplanations.push(
        `${elapsedDays} day(s) since last solve/revision (${overdue === 0 ? 'due today' : `${overdue} day(s) overdue`})`
      );
    } else {
      factorExplanations.push(
        `${elapsedDays} day(s) elapsed (due in ${targetIntervalDays - elapsedDays} day(s))`
      );
    }
  } else {
    // Problem imported from legacy stats without recorded timestamp
    urgencyFactor = 1.2;
    factorExplanations.push('Original solve timestamp unavailable (imported legacy problem)');
  }

  // 1. Difficulty weight
  let difficultyWeight = 1.0;
  const diff = problem.difficulty || 'Unknown';
  if (diff === 'Hard') {
    difficultyWeight = 1.6;
    factorExplanations.push('Hard difficulty (+60% weight)');
  } else if (diff === 'Medium') {
    difficultyWeight = 1.3;
    factorExplanations.push('Medium difficulty (+30% weight)');
  } else if (diff === 'Easy') {
    difficultyWeight = 1.0;
  } else {
    difficultyWeight = 1.1;
    factorExplanations.push('Unclassified difficulty');
  }

  // 2. Failed attempts weight
  let failureWeight = 1.0;
  const failedAttempts = problem.failedAttempts || 0;
  if (failedAttempts > 0) {
    failureWeight = 1.0 + Math.min(1.0, failedAttempts * 0.25);
    factorExplanations.push(`${failedAttempts} failed attempt(s) recorded (+${Math.round((failureWeight - 1) * 100)}% weight)`);
  } else if (problem.importedFromLegacy) {
    factorExplanations.push('Historical failed attempts not tracked prior to tracker installation');
  }

  // 3. Topic weakness weight
  let topicWeight = 1.0;
  const topicTags = problem.topicTags || [];
  const matchingWeakTopics = topicTags
    .map(t => (typeof t === 'string' ? t : (t.name || t.slug)))
    .filter(name => weakTopicsSet.has(name));

  if (matchingWeakTopics.length > 0) {
    topicWeight = 1.35;
    factorExplanations.push(`Weak topic area: ${matchingWeakTopics.join(', ')} (+35% weight)`);
  }

  // 4. Revision count progression benefit
  if (revisionCount > 0) {
    factorExplanations.push(`Revised ${revisionCount} time(s) so far`);
  }

  // Calculate composite score (normalized roughly 0 - 100)
  const rawScore = urgencyFactor * difficultyWeight * failureWeight * topicWeight * 10;
  const score = Math.round(Math.min(100, Math.max(1, rawScore)) * 10) / 10;

  let priorityLevel = 'Low';
  if (score >= 25 || (elapsedDays !== null && elapsedDays >= targetIntervalDays * 1.5)) {
    priorityLevel = 'High';
  } else if (score >= 12 || (elapsedDays !== null && elapsedDays >= targetIntervalDays)) {
    priorityLevel = 'Medium';
  }

  return {
    problemSlug: problem.problemSlug,
    frontendId: problem.frontendId,
    title: problem.title,
    difficulty: diff,
    score,
    priorityLevel,
    elapsedDays,
    targetIntervalDays,
    revisionCount,
    failedAttempts,
    topicTags,
    explanation: factorExplanations.join(' • '),
    isDue: elapsedDays !== null ? elapsedDays >= targetIntervalDays : true,
    lastActiveTimestamp,
  };
}

/**
 * Prioritize and rank all problems in the user's solved problem records
 */
export function prioritizeProblems(problemsMap = {}, now = Date.now()) {
  const problems = Object.values(problemsMap);
  if (!problems || problems.length === 0) {
    return {
      rankedQueue: [],
      dueCount: 0,
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalCount: 0,
    };
  }

  const dsaPatterns = detectDsaPatterns(problemsMap);
  const weakTopicsSet = new Set(dsaPatterns.weaknesses.map(w => w.name));

  const ranked = problems
    .map(prob => calculateProblemPriority(prob, weakTopicsSet, now))
    .sort((a, b) => b.score - a.score || (b.elapsedDays ?? 999) - (a.elapsedDays ?? 999));

  const dueCount = ranked.filter(r => r.isDue).length;
  const highCount = ranked.filter(r => r.priorityLevel === 'High').length;
  const mediumCount = ranked.filter(r => r.priorityLevel === 'Medium').length;
  const lowCount = ranked.filter(r => r.priorityLevel === 'Low').length;

  return {
    rankedQueue: ranked,
    dueCount,
    highCount,
    mediumCount,
    lowCount,
    totalCount: ranked.length,
    weakTopics: dsaPatterns.weaknesses,
  };
}
