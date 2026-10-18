/**
 * Weekly Performance Reports
 * Generates verified, evidence-based weekly reports using local calendar dates.
 * Strictly avoids synthetic or fabricated comparisons.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Returns the timestamp for the start of the week (Monday 00:00:00.000 local time)
 */
export function getLocalWeekStart(referenceDate = new Date()) {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday
  // Distance to previous Monday
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Returns the timestamp for the end of the week (Sunday 23:59:59.999 local time)
 */
export function getLocalWeekEnd(weekStartTimestamp) {
  const d = new Date(weekStartTimestamp + 6 * MS_PER_DAY);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

/**
 * Format a timestamp as a human-friendly local date string (e.g., "Oct 12, 2026")
 */
export function formatLocalDate(timestamp) {
  if (!timestamp) return 'N/A';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Aggregate metrics for a specific time window
 */
export function aggregatePeriodMetrics(submissions = [], revisions = [], problemsMap = {}, startMs, endMs) {
  const periodSubs = submissions.filter(s => s.timestamp >= startMs && s.timestamp <= endMs);
  const periodRevs = revisions.filter(r => r.timestamp >= startMs && r.timestamp <= endMs);

  const attemptedSlugs = new Set();
  const solvedSlugs = new Set();
  let acceptedCount = 0;
  let failedCount = 0;

  // Day-of-week buckets (0: Mon, 1: Tue, ... 6: Sun)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dailyCounts = days.map(name => ({ day: name, submissions: 0, solved: 0, revisions: 0 }));

  const topicCounts = {};

  for (const sub of periodSubs) {
    const isAccepted = sub.outcome === 'Accepted' || sub.statusCode === 10;
    attemptedSlugs.add(sub.problemSlug);
    if (isAccepted) {
      acceptedCount++;
      solvedSlugs.add(sub.problemSlug);
    } else {
      failedCount++;
    }

    // Daily distribution
    const subDate = new Date(sub.timestamp);
    const dayOfWeek = (subDate.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    if (dailyCounts[dayOfWeek]) {
      dailyCounts[dayOfWeek].submissions += 1;
      if (isAccepted) dailyCounts[dayOfWeek].solved += 1;
    }

    // Topic distribution from verified problem records
    const prob = problemsMap[sub.problemSlug];
    if (prob && prob.topicTags) {
      for (const tag of prob.topicTags) {
        const tName = typeof tag === 'string' ? tag : (tag.name || tag.slug);
        if (tName) {
          topicCounts[tName] = (topicCounts[tName] || 0) + 1;
        }
      }
    }
  }

  for (const rev of periodRevs) {
    const revDate = new Date(rev.timestamp);
    const dayOfWeek = (revDate.getDay() + 6) % 7;
    if (dailyCounts[dayOfWeek]) {
      dailyCounts[dayOfWeek].revisions += 1;
    }
  }

  const totalSubmissions = periodSubs.length;
  const successRate =
    totalSubmissions > 0
      ? Math.round((acceptedCount / totalSubmissions) * 1000) / 10
      : null;

  return {
    totalSubmissions,
    acceptedCount,
    failedCount,
    uniqueProblemsAttempted: attemptedSlugs.size,
    uniqueProblemsSolved: solvedSlugs.size,
    revisionsCompleted: periodRevs.length,
    successRate,
    dailyCounts,
    topicCounts,
    attemptedSlugs: Array.from(attemptedSlugs),
    solvedSlugs: Array.from(solvedSlugs),
  };
}

/**
 * Generate full weekly performance report with comparison
 */
export function generateWeeklyReport(revisionData = {}, now = Date.now()) {
  const submissions = revisionData.submissions || [];
  const revisions = revisionData.revisions || [];
  const problems = revisionData.problems || {};

  const currentWeekStart = getLocalWeekStart(new Date(now));
  const currentWeekEnd = getLocalWeekEnd(currentWeekStart);

  const prevWeekStart = currentWeekStart - 7 * MS_PER_DAY;
  const prevWeekEnd = currentWeekStart - 1;

  const current = aggregatePeriodMetrics(submissions, revisions, problems, currentWeekStart, currentWeekEnd);
  const previous = aggregatePeriodMetrics(submissions, revisions, problems, prevWeekStart, prevWeekEnd);

  const hasCurrentData = current.totalSubmissions > 0 || current.revisionsCompleted > 0;
  const hasPreviousData = previous.totalSubmissions > 0 || previous.revisionsCompleted > 0;

  let comparison = null;
  if (!hasPreviousData) {
    comparison = {
      status: 'Insufficient Data',
      message: 'Insufficient data for previous week comparison (no activity recorded between ' +
        `${formatLocalDate(prevWeekStart)} and ${formatLocalDate(prevWeekEnd)}).`,
    };
  } else {
    comparison = {
      status: 'Available',
      solvedDelta: current.uniqueProblemsSolved - previous.uniqueProblemsSolved,
      submissionsDelta: current.totalSubmissions - previous.totalSubmissions,
      revisionsDelta: current.revisionsCompleted - previous.revisionsCompleted,
      successRateDelta:
        current.successRate !== null && previous.successRate !== null
          ? Math.round((current.successRate - previous.successRate) * 10) / 10
          : null,
      message: `Compared with previous week (${formatLocalDate(prevWeekStart)} - ${formatLocalDate(prevWeekEnd)}).`,
    };
  }

  return {
    period: {
      start: currentWeekStart,
      end: currentWeekEnd,
      startFormatted: formatLocalDate(currentWeekStart),
      endFormatted: formatLocalDate(currentWeekEnd),
    },
    previousPeriod: {
      start: prevWeekStart,
      end: prevWeekEnd,
      startFormatted: formatLocalDate(prevWeekStart),
      endFormatted: formatLocalDate(prevWeekEnd),
    },
    current,
    previous,
    hasCurrentData,
    hasPreviousData,
    comparison,
  };
}
