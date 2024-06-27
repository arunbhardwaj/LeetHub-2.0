import { mergeStats } from '../scripts/leetcode/util.js';

describe('mergeStats', () => {
  it('should correctly merge stats', () => {
    const obj1 = {
      easy: 1,
      hard: 0,
      medium: 1,
      shas: {
        '0003-longest-substring-without-repeating-characters': {
          '0003-longest-substring-without-repeating-characters.js':
            '2f4a1eba5c5c7cb86e115f10252c5afb3d1bf528',
          'README.md': '23fe8b26580352e70c75f4236710f6846864a455',
          difficulty: 'medium',
        },
        '0021-merge-two-sorted-lists': {
          '0021-merge-two-sorted-lists.js': 'f393d2c3b716a7f7196af020cd7c8f7e8c994759',
          'README.md': '859aec2842f4b0ee5bcbc96fb86ed1988c287b12',
          difficulty: 'easy',
        },
      },
      solved: 2,
    };

    const obj2 = {
      easy: 1,
      hard: 1,
      medium: 0,
      shas: {
        '0021-merge-two-sorted-lists': {
          '0021-merge-two-sorted-lists.js': 'a393d2c3b716a7f7196af020cd7c8f7e8c994759',
          'README.md': '959aec2842f4b0ee5bcbc96fb86ed1988c287b12',
          difficulty: 'easy',
        },
        '0022-generate-parentheses': {
          '0022-generate-parentheses.js': '4e4a1eba5c5c7cb86e115f10252c5afb3d1bf529',
          'README.md': '33fe8b26580352e70c75f4236710f6846864a456',
          difficulty: 'hard',
        },
        '0024-sample': {
          '0022-generate-parentheses.js': '4e4a1eba5c5c7cb86e115f10252c5afb3d1bf529',
          'README.md': '33fe8b26580352e70c75f4236710f6846864a456',
          difficulty: 'hard',
        },
      },
      solved: 3,
    };

    const result = mergeStats(obj1, obj2);
    const expected = {
      easy: 1,
      hard: 2,
      medium: 1,
      shas: {
        '0003-longest-substring-without-repeating-characters': {
          '0003-longest-substring-without-repeating-characters.js':
            '2f4a1eba5c5c7cb86e115f10252c5afb3d1bf528',
          'README.md': '23fe8b26580352e70c75f4236710f6846864a455',
          difficulty: 'medium',
        },
        '0021-merge-two-sorted-lists': {
          '0021-merge-two-sorted-lists.js': 'a393d2c3b716a7f7196af020cd7c8f7e8c994759',
          'README.md': '959aec2842f4b0ee5bcbc96fb86ed1988c287b12',
          difficulty: 'easy',
        },
        '0022-generate-parentheses': {
          '0022-generate-parentheses.js': '4e4a1eba5c5c7cb86e115f10252c5afb3d1bf529',
          'README.md': '33fe8b26580352e70c75f4236710f6846864a456',
          difficulty: 'hard',
        },
        '0024-sample': {
          '0022-generate-parentheses.js': '4e4a1eba5c5c7cb86e115f10252c5afb3d1bf529',
          'README.md': '33fe8b26580352e70c75f4236710f6846864a456',
          difficulty: 'hard',
        },
      },
      solved: 4,
    };
    expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
  });

  it('should work when one has no stats', () => {
    const obj1 = {
      easy: 1,
      hard: 0,
      medium: 1,
      shas: {
        '0003-longest-substring-without-repeating-characters': {
          '0003-longest-substring-without-repeating-characters.js':
            '2f4a1eba5c5c7cb86e115f10252c5afb3d1bf528',
          'README.md': '23fe8b26580352e70c75f4236710f6846864a455',
          difficulty: 'medium',
        },
        '0021-merge-two-sorted-lists': {
          '0021-merge-two-sorted-lists.js': 'f393d2c3b716a7f7196af020cd7c8f7e8c994759',
          'README.md': '859aec2842f4b0ee5bcbc96fb86ed1988c287b12',
          difficulty: 'easy',
        },
      },
      solved: 2,
    };

    const obj2 = {
      shas: {},
    };

    const result = mergeStats(obj1, obj2);
    const expected = {
      easy: 1,
      hard: 0,
      medium: 1,
      shas: {
        '0003-longest-substring-without-repeating-characters': {
          '0003-longest-substring-without-repeating-characters.js':
            '2f4a1eba5c5c7cb86e115f10252c5afb3d1bf528',
          'README.md': '23fe8b26580352e70c75f4236710f6846864a455',
          difficulty: 'medium',
        },
        '0021-merge-two-sorted-lists': {
          '0021-merge-two-sorted-lists.js': 'f393d2c3b716a7f7196af020cd7c8f7e8c994759',
          'README.md': '859aec2842f4b0ee5bcbc96fb86ed1988c287b12',
          difficulty: 'easy',
        },
      },
      solved: 2,
    };
    expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
  });

  it('should correctly merge two objects with shas and difficulties', () => {
    const obj1 = {
      shas: {
        sha1: { difficulty: 'easy' },
        sha2: { difficulty: 'medium' },
      },
    };
    const obj2 = {
      shas: {
        sha3: { difficulty: 'hard' },
        sha4: { difficulty: 'easy' },
      },
    };

    const result = mergeStats(obj1, obj2);

    expect(result).toEqual({
      shas: {
        sha1: { difficulty: 'easy' },
        sha2: { difficulty: 'medium' },
        sha3: { difficulty: 'hard' },
        sha4: { difficulty: 'easy' },
      },
      easy: 2,
      medium: 1,
      hard: 1,
      solved: 4,
    });
  });

  it('should handle missing difficulties by setting them to zero', () => {
    const obj1 = {
      shas: {
        sha1: {},
      },
    };
    const obj2 = {
      shas: {
        sha2: {},
      },
    };

    const result = mergeStats(obj1, obj2);

    expect(JSON.stringify(result)).toBe(
      JSON.stringify({
        shas: {
          sha1: {},
          sha2: {},
        },
        easy: 0,
        medium: 0,
        hard: 0,
        solved: 0,
      })
    );
  });

  it('should handle empty objects', () => {
    const obj1 = {};
    const obj2 = {};

    const result = mergeStats(obj1, obj2);

    expect(JSON.stringify(result)).toEqual(
      JSON.stringify({
        easy: 0,
        medium: 0,
        hard: 0,
        solved: 0,
      })
    );
  });

  it('should correctly count difficulties from duplicate shas', () => {
    const obj1 = {
      shas: {
        sha1: { difficulty: 'easy' },
        sha2: { difficulty: 'medium' },
      },
    };
    const obj2 = {
      shas: {
        sha1: { difficulty: 'easy' },
        sha4: { difficulty: 'easy' },
      },
    };

    const result = mergeStats(obj1, obj2);

    expect(result).toEqual({
      shas: {
        sha1: { difficulty: 'easy' },
        sha2: { difficulty: 'medium' },
        sha4: { difficulty: 'easy' },
      },
      easy: 2,
      medium: 1,
      hard: 0,
      solved: 3,
    });
  });
});
