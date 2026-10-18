import { detectDsaPatterns } from './patternDetection.js';
import { prioritizeProblems } from './prioritizer.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Generate evidence-based problem recommendations
 */
export function generateRecommendations(problemsMap = {}, now = Date.now()) {
  const problems = Object.values(problemsMap);
  if (!problems || problems.length === 0) {
    return {
      recommendations: [],
      status: 'Insufficient Data',
      message: 'No solved problems recorded yet. Solve problems on LeetCode to receive evidence-based recommendations.',
    };
  }

  const dsaPatterns = detectDsaPatterns(problemsMap);
  const weakTopics = dsaPatterns.weaknesses;
  const weakTopicsSet = new Set(weakTopics.map(w => w.name));

  const priorityResult = prioritizeProblems(problemsMap, now);
  const prioritizedMap = new Map();
  for (const item of priorityResult.rankedQueue) {
    prioritizedMap.set(item.problemSlug, item);
  }

  const recommendations = [];
  const recommendedSlugs = new Set();

  // 1. Recommend high-priority solved problems that target weak topics and need revision
  for (const prob of problems) {
    if (recommendedSlugs.has(prob.problemSlug)) continue;

    const lastActive = prob.lastRevisedAt || prob.lastSolvedAt;
    const daysSince = lastActive ? Math.floor((now - lastActive) / MS_PER_DAY) : null;

    // Skip problems revised or solved within the last 48 hours to avoid repetition
    if (daysSince !== null && daysSince < 2) continue;

    const topicTags = prob.topicTags || [];
    const sharedWeakTopics = topicTags
      .map(t => (typeof t === 'string' ? t : (t.name || t.slug)))
      .filter(name => weakTopicsSet.has(name));

    const prio = prioritizedMap.get(prob.problemSlug);
    const failed = prob.failedAttempts || 0;

    let score = 0;
    const reasons = [];

    if (sharedWeakTopics.length > 0) {
      score += 40;
      reasons.push(`Covers your current weak topic area: ${sharedWeakTopics.join(', ')}`);
    }

    if (prio && prio.isDue) {
      score += 30;
      reasons.push(
        daysSince !== null
          ? `Due for spaced revision (${daysSince} day(s) since last attempt)`
          : 'Due for revision (historical solve imported)'
      );
    }

    if (failed > 0) {
      score += Math.min(20, failed * 10);
      reasons.push(`${failed} failed attempt(s) recorded before completion`);
    }

    if (prob.difficulty === 'Hard') score += 10;
    else if (prob.difficulty === 'Medium') score += 5;

    if (score >= 25) {
      recommendedSlugs.add(prob.problemSlug);
      recommendations.push({
        problemSlug: prob.problemSlug,
        frontendId: prob.frontendId,
        title: prob.title,
        difficulty: prob.difficulty || 'Unknown',
        topicTags: prob.topicTags || [],
        source: 'Revision Queue',
        score,
        reason: reasons.join(' • '),
        isSolvedByUser: true,
        lastActiveFormatted: lastActive ? new Date(lastActive).toLocaleDateString() : 'Historical',
        url: `https://leetcode.com/problems/${prob.problemSlug.replace(/^\d+-/, '')}/`,
      });
    }
  }

  // 2. Discover verified similar questions attached from LeetCode GraphQL
  for (const prob of problems) {
    const similarList = prob.similarQuestions || [];
    if (!similarList || similarList.length === 0) continue;

    const failed = prob.failedAttempts || 0;
    const isWeakContext = (prob.topicTags || []).some(t => {
      const name = typeof t === 'string' ? t : (t.name || t.slug);
      return weakTopicsSet.has(name);
    });

    for (const sim of similarList) {
      const simSlug = sim.titleSlug;
      if (!simSlug || recommendedSlugs.has(simSlug)) continue;

      // Only recommend verified similar questions from problems where the user struggled or needs reinforcement
      if (failed > 0 || isWeakContext) {
        recommendedSlugs.add(simSlug);
        recommendations.push({
          problemSlug: simSlug,
          frontendId: '',
          title: sim.title || simSlug,
          difficulty: sim.difficulty || 'Unknown',
          topicTags: prob.topicTags || [],
          source: 'Verified LeetCode Similar Question',
          score: 35 + (failed > 0 ? 10 : 0),
          reason: `Verified similar problem to '${prob.title}' on LeetCode to reinforce pattern recognition.`,
          isSolvedByUser: false,
          lastActiveFormatted: 'New Problem',
          url: `https://leetcode.com/problems/${simSlug}/`,
        });
      }
    }
  }

  recommendations.sort((a, b) => b.score - a.score);

  return {
    recommendations: recommendations.slice(0, 15),
    totalRecommendations: recommendations.length,
    status: recommendations.length > 0 ? 'Available' : 'Insufficient Data',
    message:
      recommendations.length > 0
        ? `Found ${recommendations.length} tailored recommendation(s) based on your verified performance.`
        : 'More problem activity needed to generate specialized recommendations.',
  };
}
