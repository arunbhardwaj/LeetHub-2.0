import {
  createMetadataMonitor,
  getCanonicalProblemUrl,
  getProblemMetadata,
  getProblemSlug,
  htmlToMarkdown,
  normalizeDifficulty,
  sanitizeSlug,
} from '../scripts/gfg/metadata.js';

function structuredDocument(data) {
  let reads = 0;
  const payload = JSON.stringify({
    props: {
      pageProps: {
        initialState: {
          problemApi: {
            queries: {
              details: {
                endpointName: 'getProblemDetails',
                status: 'fulfilled',
                data,
              },
            },
          },
        },
      },
    },
  });

  return {
    documentObject: {
      querySelector(selector) {
        reads++;
        if (selector === '#__NEXT_DATA__') return { textContent: payload };
        return null;
      },
    },
    get reads() {
      return reads;
    },
  };
}

describe('GFG problem metadata', () => {
  it('normalizes current difficulty values without guessing unknowns', () => {
    expect(normalizeDifficulty('Difficulty: Easy')).toBe('easy');
    expect(normalizeDifficulty('MEDIUM')).toBe('medium');
    expect(normalizeDifficulty('Hard')).toBe('hard');
    expect(normalizeDifficulty('Basic')).toBe('basic');
    expect(normalizeDifficulty('School')).toBe('school');
    expect(normalizeDifficulty('Expert')).toBeNull();
    expect(normalizeDifficulty(null)).toBeNull();
  });

  it('derives a stable safe slug only from valid problem URLs', () => {
    const url = 'https://www.geeksforgeeks.org/problems/binary-search-1587115620/1';
    expect(getProblemSlug(url)).toBe('binary-search-1587115620');
    expect(getProblemSlug(url)).toBe('binary-search-1587115620');
    expect(getProblemSlug('https://www.geeksforgeeks.org/articles/binary-search')).toBeNull();
    expect(sanitizeSlug('../Binary Search\\unsafe')).toBe('binary-search-unsafe');
  });

  it('removes query and hash data from the canonical problem URL', () => {
    expect(
      getCanonicalProblemUrl(
        'https://www.geeksforgeeks.org/problems/binary-search/1?utm_source=test#discussion'
      )
    ).toBe('https://www.geeksforgeeks.org/problems/binary-search/1');
    expect(
      getCanonicalProblemUrl('https://www.geeksforgeeks.org/articles/binary-search')
    ).toBeNull();
  });

  it('converts representative statement HTML into readable Markdown', () => {
    const statement = htmlToMarkdown(`
      <p>Given an array <code>arr[]</code> &amp; a target.</p>
      <p>Find a value where x &lt;= 10<sup>5</sup>.</p>
      <p><strong>Examples:</strong></p>
      <pre><strong>Input:</strong> 1 2 3 4
<strong>Output:</strong> 2</pre>
      <p><strong>Constraints:</strong><br>1 &lt;= n &lt;= 10<sup>5</sup></p>
    `);

    expect(statement).toContain('Given an array `arr[]` & a target.');
    expect(statement).toContain('x <= 10^5');
    expect(statement).toContain('```text\nInput: 1 2 3 4\nOutput: 2\n```');
    expect(statement).toContain('**Constraints:**\n1 <= n <= 10^5');
  });

  it('extracts structured data and excludes unrelated fields', () => {
    const fixture = structuredDocument({
      id: 123,
      slug: 'binary-search-1587115620',
      problem_name: '  Binary Search  ',
      difficulty: 'Easy',
      problem_question: '<p>Find the target.</p><p><strong>Constraints:</strong><br>1 &lt;= n</p>',
      tags: { topic_tags: ['Binary Search'], company_tags: ['Example Corp'] },
      editorial: 'Do not capture this solution',
    });

    const metadata = getProblemMetadata(
      fixture.documentObject,
      'https://www.geeksforgeeks.org/problems/binary-search-1587115620/1?utm=test',
      { now: () => 99 }
    );

    expect(metadata).toEqual(
      jasmine.objectContaining({
        title: 'Binary Search',
        slug: 'binary-search-1587115620',
        routeKey: 'binary-search-1587115620/1',
        url: 'https://www.geeksforgeeks.org/problems/binary-search-1587115620/1',
        difficulty: 'easy',
        problemId: 123,
        capturedAt: 99,
        metadataSource: 'structured',
      })
    );
    expect(metadata.statement).toContain('Find the target.');
    expect(metadata.statement).not.toContain('Do not capture this solution');
    expect(metadata.tags).toEqual(['Binary Search']);
    expect(metadata.metadataErrors).toEqual([]);
  });

  it('rejects stale structured data after a route change', () => {
    const fixture = structuredDocument({
      slug: 'problem-a',
      problem_name: 'Problem A',
      difficulty: 'Easy',
      problem_question: '<p>Problem A statement</p>',
    });

    const metadata = getProblemMetadata(
      fixture.documentObject,
      'https://www.geeksforgeeks.org/problems/problem-b/1'
    );

    expect(metadata.slug).toBe('problem-b');
    expect(metadata.title).toBeNull();
    expect(metadata.statement).toBeNull();
    expect(metadata.metadataErrors).toContain('title_not_found');
    expect(metadata.metadataErrors).toContain('statement_not_found');
  });

  it('uses the route-validated DOM fallback after SPA navigation', () => {
    const stale = structuredDocument({
      slug: 'problem-a',
      problem_name: 'Problem A',
      difficulty: 'Easy',
      problem_question: '<p>Statement A</p>',
    });
    const root = {
      querySelectorAll(selector) {
        if (selector === 'h1, h2, h3') return [{ textContent: 'Problem B' }];
        if (selector === 'span') return [{ textContent: 'Difficulty: Hard' }];
        return [];
      },
      querySelector: () => ({ innerHTML: '<p>Statement B</p>' }),
    };
    const documentObject = {
      querySelector(selector) {
        if (selector === '#__NEXT_DATA__') {
          return stale.documentObject.querySelector(selector);
        }
        if (selector === 'link[rel="canonical"]') {
          return {
            href: 'https://www.geeksforgeeks.org/problems/problem-b/1',
          };
        }
        if (selector === '#scrollableDiv') return root;
        return null;
      },
    };

    const metadata = getProblemMetadata(
      documentObject,
      'https://www.geeksforgeeks.org/problems/problem-b/1'
    );

    expect(metadata.title).toBe('Problem B');
    expect(metadata.difficulty).toBe('hard');
    expect(metadata.statement).toBe('Statement B');
    expect(metadata.metadataSource).toBe('dom');
  });

  it('captures ready metadata once and returns the cached route snapshot', () => {
    const fixture = structuredDocument({
      slug: 'problem-a',
      problem_name: 'Problem A',
      difficulty: 'Medium',
      problem_question: '<p>Problem A statement</p>',
    });
    const published = [];
    const monitor = createMetadataMonitor({
      document: fixture.documentObject,
      location: { href: 'https://www.geeksforgeeks.org/problems/problem-a/1' },
      routeKey: 'problem-a/1',
      onMetadata: metadata => published.push(metadata),
      MutationObserverClass: class {
        constructor() {
          throw new Error('ready metadata must not create an observer');
        }
      },
    });

    const first = monitor.getSnapshot();
    const second = monitor.getSnapshot();
    expect(first).toBe(second);
    expect(first.title).toBe('Problem A');
    expect(published).toEqual([first]);
    monitor.cleanup();
  });

  it('keeps route metadata isolated across problem monitors', () => {
    const problemA = structuredDocument({
      slug: 'problem-a',
      problem_name: 'Problem A',
      difficulty: 'Easy',
      problem_question: '<p>Statement A</p>',
    });
    const problemB = structuredDocument({
      slug: 'problem-b',
      problem_name: 'Problem B',
      difficulty: 'Hard',
      problem_question: '<p>Statement B</p>',
    });
    const monitorA = createMetadataMonitor({
      document: problemA.documentObject,
      location: { href: 'https://www.geeksforgeeks.org/problems/problem-a/1' },
      routeKey: 'problem-a/1',
    });
    const monitorB = createMetadataMonitor({
      document: problemB.documentObject,
      location: { href: 'https://www.geeksforgeeks.org/problems/problem-b/1' },
      routeKey: 'problem-b/1',
    });

    expect(monitorA.getSnapshot().title).toBe('Problem A');
    expect(monitorB.getSnapshot().title).toBe('Problem B');
    expect(monitorB.getSnapshot().statement).not.toContain('Statement A');
    monitorA.cleanup();
    monitorB.cleanup();
  });
});
