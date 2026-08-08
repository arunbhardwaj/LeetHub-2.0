import { parseGfgProblemUrl } from './router.js';

const METADATA_TIMEOUT_MS = 15000;

const BLOCK_TAGS = /<\/?(?:article|section|div|p|ul|ol|table|thead|tbody|tfoot|tr|blockquote|figure|figcaption)[^>]*>/gi;

function decodeHtmlEntities(value) {
  const named = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };

  return String(value ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, key) => {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }
    return named[normalized] ?? entity;
  });
}

function plainTextFromHtml(value) {
  return decodeHtmlEntities(
    String(value ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(BLOCK_TAGS, '\n')
      .replace(/<[^>]+>/g, '')
  )
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function normalizeStatementWhitespace(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function htmlToMarkdown(html) {
  if (typeof html !== 'string' || !html.trim()) return null;

  const preformatted = [];
  let output = html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi, (_match, content) => {
      const token = `GFGHUBPREBLOCK${preformatted.length}TOKEN`;
      preformatted.push(`\`\`\`text\n${plainTextFromHtml(content)}\n\`\`\``);
      return `\n\n${token}\n\n`;
    })
    .replace(/<img\b[^>]*>/gi, tag => {
      const source = tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      if (!source || !/^https?:\/\//i.test(source)) return '';
      const alt = decodeHtmlEntities(tag.match(/\balt=["']([^"']*)["']/i)?.[1] ?? '')
        .replace(/\s+/g, ' ')
        .trim();
      return `\n\n![${alt || 'Problem illustration'}](${source})\n\n`;
    })
    .replace(
      /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/gi,
      (_match, content) => `\n\n### ${plainTextFromHtml(content)}\n\n`
    )
    .replace(
      /<code\b[^>]*>([\s\S]*?)<\/code>/gi,
      (_match, content) => `\`${plainTextFromHtml(content).replace(/`/g, '\\`')}\``
    )
    .replace(
      /<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi,
      (_match, _tag, content) => `**${plainTextFromHtml(content)}**`
    )
    .replace(
      /<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi,
      (_match, _tag, content) => `_${plainTextFromHtml(content)}_`
    )
    .replace(
      /<sup\b[^>]*>([\s\S]*?)<\/sup>/gi,
      (_match, content) => `^${plainTextFromHtml(content)}`
    )
    .replace(
      /<sub\b[^>]*>([\s\S]*?)<\/sub>/gi,
      (_match, content) => `_${plainTextFromHtml(content)}`
    )
    .replace(/<li\b[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?(?:td|th)\b[^>]*>/gi, ' | ')
    .replace(BLOCK_TAGS, '\n\n')
    .replace(/<[^>]+>/g, '');

  output = decodeHtmlEntities(output).replace(/\u00a0/g, ' ');
  preformatted.forEach((block, index) => {
    output = output.replace(`GFGHUBPREBLOCK${index}TOKEN`, block);
  });

  return normalizeStatementWhitespace(output) || null;
}

export function normalizeDifficulty(value) {
  const normalized = String(value ?? '')
    .replace(/^difficulty\s*:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return ['school', 'basic', 'easy', 'medium', 'hard'].includes(normalized) ? normalized : null;
}

export function sanitizeSlug(value) {
  let decoded;
  try {
    decoded = decodeURIComponent(String(value ?? ''));
  } catch (_error) {
    return null;
  }

  const slug = decoded
    .split(/[?#]/)[0]
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[\\/]+/g, '-')
    .replace(/\.{2,}/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return slug || null;
}

export function getProblemSlug(input) {
  const parsed = parseGfgProblemUrl(input);
  return parsed ? sanitizeSlug(parsed.slug) : null;
}

export function getCanonicalProblemUrl(input) {
  let url;
  try {
    url = input instanceof URL ? input : new URL(input);
  } catch (_error) {
    return null;
  }

  const parsed = parseGfgProblemUrl(url);
  const slug = parsed && sanitizeSlug(parsed.slug);
  const problemType = parsed && sanitizeSlug(parsed.problemType);
  if (!slug || !problemType) return null;

  return `${url.protocol}//${url.hostname}/problems/${slug}/${problemType}`;
}

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getStructuredProblemData(documentObject, expectedSlug) {
  const raw = documentObject.querySelector('#__NEXT_DATA__')?.textContent;
  if (!raw) return null;

  try {
    const nextData = JSON.parse(raw);
    const queries = nextData?.props?.pageProps?.initialState?.problemApi?.queries;
    const query = Object.values(queries ?? {}).find(
      entry =>
        entry?.endpointName === 'getProblemDetails' &&
        entry?.data &&
        sanitizeSlug(entry.data.slug) === expectedSlug
    );
    const data = query?.data;
    if (!data) return null;
    return data;
  } catch (_error) {
    return null;
  }
}

function getDomProblemData(documentObject, expectedSlug) {
  const canonicalHref = documentObject.querySelector('link[rel="canonical"]')?.href;
  if (getProblemSlug(canonicalHref) !== expectedSlug) return null;

  const root = documentObject.querySelector('#scrollableDiv');
  if (!root) return null;

  const heading = [...root.querySelectorAll('h1, h2, h3')].find(element =>
    normalizeText(element.textContent)
  );
  const difficultyElement = [...root.querySelectorAll('span')].find(element =>
    normalizeText(element.textContent).toLowerCase().startsWith('difficulty:')
  );
  const statementElement = root.querySelector('[class*="problems_problem_content__"]');

  return {
    problem_name: normalizeText(heading?.textContent) || null,
    difficulty: normalizeText(difficultyElement?.textContent) || null,
    problem_question: statementElement?.innerHTML ?? null,
  };
}

function addError(errors, condition, error) {
  if (condition && !errors.includes(error)) errors.push(error);
}

export function getProblemMetadata(
  documentObject,
  locationInput,
  { routeKey = null, now = Date.now, extraErrors = [] } = {}
) {
  const href = typeof locationInput === 'string' ? locationInput : locationInput?.href;
  const parsed = parseGfgProblemUrl(href);
  const slug = getProblemSlug(href);
  const url = getCanonicalProblemUrl(href);
  const resolvedRouteKey = routeKey ?? parsed?.routeKey ?? null;
  const structured = slug ? getStructuredProblemData(documentObject, slug) : null;
  const source = structured ?? getDomProblemData(documentObject, slug) ?? {};
  const title = normalizeText(source.problem_name) || null;
  const difficulty = normalizeDifficulty(source.difficulty ?? source.problem_level_text);
  const statement = htmlToMarkdown(source.problem_question);
  const metadataErrors = [...extraErrors];

  addError(metadataErrors, !parsed || !slug || !url, 'invalid_problem_url');
  addError(metadataErrors, !title, 'title_not_found');
  addError(metadataErrors, !statement, 'statement_not_found');
  addError(metadataErrors, !difficulty, 'difficulty_not_found');

  return Object.freeze({
    title,
    slug,
    routeKey: resolvedRouteKey,
    url,
    difficulty,
    statement,
    problemId: structured?.id ?? null,
    tags: Object.freeze([...(structured?.tags?.topic_tags ?? [])]),
    capturedAt: now(),
    metadataErrors: Object.freeze(metadataErrors),
    metadataSource: structured ? 'structured' : 'dom',
  });
}

function isMetadataReady(metadata) {
  return Boolean(metadata.title && metadata.slug && metadata.url && metadata.statement);
}

export function createMetadataMonitor({
  document: documentObject,
  location: locationObject,
  routeKey,
  onMetadata = () => {},
  now = Date.now,
  timeoutMs = METADATA_TIMEOUT_MS,
  MutationObserverClass = globalThis.MutationObserver,
}) {
  let current = getProblemMetadata(documentObject, locationObject, { routeKey, now });
  let observer = null;
  let timeoutId = null;
  let scheduledId = null;
  let destroyed = false;

  const publishAndStop = metadata => {
    current = metadata;
    observer?.disconnect();
    observer = null;
    clearTimeout(timeoutId);
    timeoutId = null;
    onMetadata(current);
  };

  const capture = () => {
    if (destroyed) return;
    current = getProblemMetadata(documentObject, locationObject, { routeKey, now });
    if (isMetadataReady(current)) publishAndStop(current);
  };

  if (isMetadataReady(current)) {
    onMetadata(current);
  } else {
    observer = new MutationObserverClass(() => {
      if (scheduledId !== null) return;
      scheduledId = setTimeout(() => {
        scheduledId = null;
        capture();
      }, 50);
    });
    observer.observe(documentObject.documentElement, { childList: true, subtree: true });
    timeoutId = setTimeout(() => {
      if (destroyed) return;
      const timedOut = getProblemMetadata(documentObject, locationObject, {
        routeKey,
        now,
        extraErrors: ['metadata_timeout'],
      });
      publishAndStop(timedOut);
    }, timeoutMs);
  }

  return Object.freeze({
    getSnapshot() {
      return current;
    },
    cleanup() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      clearTimeout(timeoutId);
      clearTimeout(scheduledId);
    },
  });
}
