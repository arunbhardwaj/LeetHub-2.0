import { LANGUAGE_DEFINITIONS } from '../core/languages.js';
import { sanitizeSlug } from './metadata.js';

const LANGUAGE_LABELS = Object.freeze({
  c: 'C',
  cpp: 'C++',
  csharp: 'C#',
  dart: 'Dart',
  go: 'Go',
  java: 'Java',
  javascript: 'JavaScript',
  kotlin: 'Kotlin',
  php: 'PHP',
  python: 'Python',
  ruby: 'Ruby',
  rust: 'Rust',
  scala: 'Scala',
  swift: 'Swift',
  typescript: 'TypeScript',
});

const EXTENSION_LANGUAGES = Object.freeze(
  Object.fromEntries(
    LANGUAGE_DEFINITIONS.map(definition => [definition.extension, definition.normalized])
  )
);

export function createEmptyRepositoryIndex() {
  return { version: 1, nextNumber: 1, problems: {} };
}

export function normalizeRepositoryIndex(value) {
  const source = value && typeof value === 'object' ? value : {};
  const problems = source.problems && typeof source.problems === 'object' ? source.problems : {};
  const highestNumber = Math.max(
    0,
    ...Object.values(problems).map(problem => Number(problem?.number) || 0)
  );
  return {
    version: 1,
    nextNumber: Math.max(Number(source.nextNumber) || 1, highestNumber + 1),
    problems: structuredClone(problems),
  };
}

export function getVisibleProblemSlug(value) {
  const slug = sanitizeSlug(value);
  if (!slug) return null;
  return slug.replace(/-\d{10}$/, '') || slug;
}

export function formatProblemDirectory(number, slug) {
  return `${String(number).padStart(4, '0')}-${slug}`;
}

export function reserveRepositoryProblem(indexValue, problem) {
  const index = normalizeRepositoryIndex(indexValue);
  const identity = sanitizeSlug(problem?.slug);
  const visibleSlug = getVisibleProblemSlug(identity);
  if (!identity || !visibleSlug) throw new Error('problem_slug_missing');

  let entry = index.problems[identity];
  if (!entry) {
    const number = index.nextNumber;
    entry = {
      identity,
      number,
      slug: visibleSlug,
      directory: formatProblemDirectory(number, visibleSlug),
      synced: false,
      title: null,
      difficulty: null,
      url: null,
      languages: [],
      topics: [],
    };
    index.problems[identity] = entry;
    index.nextNumber = number + 1;
  }

  return { index, entry: structuredClone(entry) };
}

function normalizeList(values) {
  return [
    ...new Set(
      (values ?? [])
        .filter(value => value !== null && value !== undefined)
        .map(value => String(value).trim())
        .filter(Boolean)
    ),
  ];
}

function markdownCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

export function finalizeRepositoryProblem(indexValue, problem, languages = []) {
  const reserved = reserveRepositoryProblem(indexValue, problem);
  const entry = reserved.index.problems[reserved.entry.identity];
  entry.synced = true;
  entry.title = String(problem.title ?? entry.title ?? entry.slug)
    .replace(/\s+/g, ' ')
    .trim();
  entry.difficulty = problem.difficulty ?? entry.difficulty ?? null;
  entry.url = problem.url ?? entry.url ?? null;
  entry.languages = normalizeList([...(entry.languages ?? []), ...languages]);
  const topics = Array.isArray(problem.tags)
    ? problem.tags.filter(topic => typeof topic === 'string')
    : entry.topics;
  entry.topics = normalizeList(topics ?? []).sort((a, b) => a.localeCompare(b));
  return { index: reserved.index, entry: structuredClone(entry) };
}

export function languageFromExtension(extension) {
  return EXTENSION_LANGUAGES[extension] ?? null;
}

export function displayLanguage(language) {
  return LANGUAGE_LABELS[language] ?? String(language ?? '').trim();
}

function displayDifficulty(value) {
  if (!value) return 'Unknown';
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function generateRootReadme(indexValue) {
  const index = normalizeRepositoryIndex(indexValue);
  const problems = Object.values(index.problems)
    .filter(problem => problem?.synced)
    .sort((a, b) => a.number - b.number);
  const lines = [
    '# GeeksforGeeks Practice',
    '',
    'Automatically synced GeeksforGeeks solutions.',
    '',
    '## Problems',
    '',
    '| # | Problem | Difficulty | Language |',
    '|---|---------|------------|----------|',
  ];

  for (const problem of problems) {
    const languages = (problem.languages ?? []).map(displayLanguage).join(', ');
    lines.push(
      `| ${problem.number} | [${markdownCell(problem.title)}](./${
        problem.directory
      }) | ${displayDifficulty(problem.difficulty)} | ${markdownCell(languages || 'Unknown')} |`
    );
  }

  const topics = new Map();
  for (const problem of problems) {
    for (const topic of problem.topics ?? []) {
      const entries = topics.get(topic) ?? [];
      entries.push(problem);
      topics.set(topic, entries);
    }
  }

  if (topics.size > 0) {
    lines.push('', '## Topics');
    for (const topic of [...topics.keys()].sort((a, b) => a.localeCompare(b))) {
      lines.push('', `### ${topic}`, '');
      for (const problem of topics.get(topic).sort((a, b) => a.number - b.number)) {
        lines.push(`- [${problem.directory}](./${problem.directory})`);
      }
    }
  }

  return `${lines.join('\n')}\n`;
}
