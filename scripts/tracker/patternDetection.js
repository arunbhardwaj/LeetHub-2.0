/**
 * DSA Pattern Detection
 * Analyzes verified topic tags, submission outcomes, and failed attempts
 * to derive evidence-based strengths, weaknesses, and patterns.
 */

export function detectDsaPatterns(problemsMap = {}) {
  const problems = Object.values(problemsMap);
  const topicStats = {};

  let problemsWithTags = 0;
  let problemsWithoutTags = 0;

  for (const prob of problems) {
    const tags = prob.topicTags || [];
    if (!tags || tags.length === 0) {
      problemsWithoutTags++;
      continue;
    }
    problemsWithTags++;

    const failed = prob.failedAttempts || 0;
    const success = prob.successCount || (prob.lastSolvedAt ? 1 : 0);
    const totalSubmissions = prob.totalSubmissions || (failed + success) || 1;
    const isSolved = success > 0 || !!prob.lastSolvedAt;

    for (const tag of tags) {
      const topicName = typeof tag === 'string' ? tag : (tag.name || tag.slug);
      if (!topicName) continue;

      if (!topicStats[topicName]) {
        topicStats[topicName] = {
          name: topicName,
          totalProblems: 0,
          solvedProblems: 0,
          failedAttempts: 0,
          successCount: 0,
          totalSubmissions: 0,
          difficulties: { Easy: 0, Medium: 0, Hard: 0, Unknown: 0 },
          problemSlugs: [],
        };
      }

      const t = topicStats[topicName];
      t.totalProblems += 1;
      if (isSolved) t.solvedProblems += 1;
      t.failedAttempts += failed;
      t.successCount += success;
      t.totalSubmissions += totalSubmissions;
      t.problemSlugs.push(prob.problemSlug);

      const diff = prob.difficulty || 'Unknown';
      if (t.difficulties[diff] !== undefined) {
        t.difficulties[diff] += 1;
      } else {
        t.difficulties.Unknown += 1;
      }
    }
  }

  const evaluatedTopics = Object.values(topicStats).map(t => {
    const accuracy =
      t.totalSubmissions > 0
        ? Math.round((t.successCount / t.totalSubmissions) * 100) / 100
        : null;

    let status = 'Insufficient Data';
    let rationale = '';

    if (t.totalSubmissions === 0 || t.totalProblems === 0) {
      status = 'Insufficient Data';
      rationale = 'No submission attempts recorded for this topic yet.';
    } else if (t.totalProblems < 2 && t.failedAttempts === 0) {
      status = 'Insufficient Data';
      rationale = 'Only 1 problem recorded. Minimum 2 problems or failed attempts needed for reliable pattern detection.';
    } else if (t.failedAttempts > 0 && accuracy !== null && accuracy < 0.6) {
      status = 'Needs Practice';
      rationale = `Accuracy is ${(accuracy * 100).toFixed(0)}% across ${t.totalProblems} problems with ${t.failedAttempts} failed attempt(s).`;
    } else if (accuracy !== null && accuracy >= 0.8 && t.totalProblems >= 2) {
      status = 'Strength';
      rationale = `Strong ${(accuracy * 100).toFixed(0)}% success rate across ${t.totalProblems} problems.`;
    } else if (accuracy !== null) {
      status = 'Developing';
      rationale = `Moderate ${(accuracy * 100).toFixed(0)}% success rate across ${t.totalProblems} problem(s).`;
    } else {
      status = 'Insufficient Data';
      rationale = 'Insufficient submission records to determine topic pattern.';
    }

    return {
      ...t,
      accuracy,
      status,
      rationale,
    };
  });

  // Sort weaknesses by lowest accuracy, then highest failed attempts
  const weaknesses = evaluatedTopics
    .filter(t => t.status === 'Needs Practice')
    .sort((a, b) => (a.accuracy ?? 1) - (b.accuracy ?? 1) || b.failedAttempts - a.failedAttempts);

  // Sort strengths by highest accuracy, then problem count
  const strengths = evaluatedTopics
    .filter(t => t.status === 'Strength')
    .sort((a, b) => (b.accuracy ?? 0) - (a.accuracy ?? 0) || b.totalProblems - a.totalProblems);

  const developing = evaluatedTopics
    .filter(t => t.status === 'Developing')
    .sort((a, b) => b.totalProblems - a.totalProblems);

  const insufficientData = evaluatedTopics.filter(t => t.status === 'Insufficient Data');

  return {
    topics: evaluatedTopics,
    weaknesses,
    strengths,
    developing,
    insufficientData,
    summary: {
      totalTopics: evaluatedTopics.length,
      problemsWithTags,
      problemsWithoutTags,
      hasEnoughData: evaluatedTopics.length > 0 && (strengths.length > 0 || weaknesses.length > 0),
    },
  };
}
