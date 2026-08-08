function createEmptyStats() {
  return {
    shas: {},
    solvedSlugs: [],
    solved: 0,
    easy: 0,
    medium: 0,
    hard: 0,
  };
}

function recordSolvedProblem(stats, slug, difficulty) {
  const nextStats = {
    ...createEmptyStats(),
    ...stats,
    shas: stats?.shas ?? {},
    solvedSlugs: Array.isArray(stats?.solvedSlugs) ? [...stats.solvedSlugs] : [],
  };

  if (nextStats.solvedSlugs.includes(slug)) {
    return { stats: nextStats, isNew: false };
  }

  nextStats.solvedSlugs.push(slug);
  nextStats.solved = Number(nextStats.solved) + 1;
  const normalizedDifficulty = String(difficulty ?? '')
    .trim()
    .toLowerCase();
  if (['easy', 'medium', 'hard'].includes(normalizedDifficulty)) {
    nextStats[normalizedDifficulty] = Number(nextStats[normalizedDifficulty]) + 1;
  }

  return { stats: nextStats, isNew: true };
}

export { createEmptyStats, recordSolvedProblem };
