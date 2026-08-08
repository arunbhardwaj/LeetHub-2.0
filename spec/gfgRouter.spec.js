import {
  createRouteMonitor,
  getProblemRouteKey,
  isGfgProblemPage,
  parseGfgProblemUrl,
} from '../scripts/gfg/router.js';

describe('GFG problem routing', () => {
  it('recognizes current www and non-www problem URLs', () => {
    expect(
      isGfgProblemPage('https://www.geeksforgeeks.org/problems/binary-search-1587115620/1')
    ).toBeTrue();
    expect(
      isGfgProblemPage('https://geeksforgeeks.org/problems/prerequisite-tasks/1/?utm_source=test')
    ).toBeTrue();
  });

  it('rejects non-problem, malformed, foreign, and insecure URLs', () => {
    [
      'https://www.geeksforgeeks.org/',
      'https://www.geeksforgeeks.org/articles/binary-search/',
      'https://www.geeksforgeeks.org/problems/',
      'https://www.geeksforgeeks.org/problems/binary-search/',
      'https://www.geeksforgeeks.org/problems/a/1/extra',
      'https://example.com/problems/two-sum/',
      'http://www.geeksforgeeks.org/problems/two-sum/1',
      'not a URL',
    ].forEach(url => expect(isGfgProblemPage(url)).toBeFalse());
  });

  it('extracts a stable route identity without query or hash data', () => {
    const url =
      'https://www.geeksforgeeks.org/problems/binary-search-1587115620/1?tab=problem#editor';

    expect(parseGfgProblemUrl(url)).toEqual({
      slug: 'binary-search-1587115620',
      problemType: '1',
      routeKey: 'binary-search-1587115620/1',
    });
    expect(getProblemRouteKey(url)).toBe('binary-search-1587115620/1');
  });

  it('detects route changes once and removes every lifecycle hook on cleanup', () => {
    const listeners = new Map();
    let intervalCallback;
    let intervalCleared = false;
    const fakeWindow = {
      location: {
        href: 'https://www.geeksforgeeks.org/problems/problem-a/1',
      },
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
      removeEventListener(type, callback) {
        if (listeners.get(type) === callback) listeners.delete(type);
      },
      setInterval(callback, delay) {
        expect(delay).toBe(1000);
        intervalCallback = callback;
        return 42;
      },
      clearInterval(id) {
        expect(id).toBe(42);
        intervalCleared = true;
      },
    };
    const changes = [];
    const cleanup = createRouteMonitor(fakeWindow, (...args) => changes.push(args));

    expect(changes).toEqual([['problem-a/1', null]]);
    intervalCallback();
    expect(changes.length).toBe(1);

    fakeWindow.location.href = 'https://www.geeksforgeeks.org/problems/problem-b/1';
    intervalCallback();
    expect(changes[1]).toEqual(['problem-b/1', 'problem-a/1']);

    fakeWindow.location.href = 'https://www.geeksforgeeks.org/articles/example/';
    listeners.get('popstate')();
    expect(changes[2]).toEqual([null, 'problem-b/1']);

    cleanup();
    expect(intervalCleared).toBeTrue();
    expect(listeners.size).toBe(0);
  });
});
