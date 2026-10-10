import {
  appendProblemToReadme,
  sortTopicsInReadme,
  getTopicTags,
  getFallbackTopic,
  DEFAULT_FALLBACK_TOPIC,
} from '../scripts/leetcode/readmeTopics.js';

describe('appendProblemToReadme', () => {
  it('should correctly append to previous readme which has start and end tags', () => {
    const sampleText =
      '# LeetCode Topics\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n<!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n\n<!---LeetCode Topics End-->';
    const output = appendProblemToReadme('Hash Table', sampleText, 'any', '0013-roman-to-integer');
    const expected =
      '# LeetCode Topics\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n<!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n| [0013-roman-to-integer](https://github.com/any/tree/master/0013-roman-to-integer) |\n\n\n\n<!---LeetCode Topics End-->';
    expect(output).toBe(expected);
  });

  it('should not append duplicate problem', () => {
    const sampleText =
      'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)\n# LeetCode Topics\n## Math\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n| [0009-palindrome-number](https://github.com/arunbhardwaj/algos2/tree/master/0009-palindrome-number) |\n## Array\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n## Hash Table\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Linked List\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## Recursion\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## String\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Sliding Window\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n<!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0013-roman-to-integer](https://github.com/any/tree/master/0013-roman-to-integer) |\n| [0002-fake-problem](https://github.com/any/tree/master/0002-fake-problem) |\n| [0012-fake-problem](https://github.com/any/tree/master/0012-fake-problem) |\n| [0009-fake-problem](https://github.com/any/tree/master/0009-fake-problem) |\n| [0090-fake-problem](https://github.com/any/tree/master/0090-fake-problem) |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n\n<!---LeetCode Topics End-->';
    const output = appendProblemToReadme('Hash Table', sampleText, 'any', '0013-roman-to-integer');
    const expected =
      'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)\n# LeetCode Topics\n## Math\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n| [0009-palindrome-number](https://github.com/arunbhardwaj/algos2/tree/master/0009-palindrome-number) |\n## Array\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n## Hash Table\n|  |\n| ------- |\n| [0001-two-sum](https://github.com/arunbhardwaj/algos2/tree/master/0001-two-sum) |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Linked List\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## Recursion\n|  |\n| ------- |\n| [0002-add-two-numbers](https://github.com/arunbhardwaj/algos2/tree/master/0002-add-two-numbers) |\n## String\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n## Sliding Window\n|  |\n| ------- |\n| [0003-longest-substring-without-repeating-characters](https://github.com/arunbhardwaj/algos2/tree/master/0003-longest-substring-without-repeating-characters) |\n\n### Extra Hard questions\nThese are notes I want for extra hard problems\n\n# About me\nThis a repo I had that I wished to do xyz with\n\n<!---LeetCode Topics Start-->\n# LeetCode Topics\n\n## Hash Table\n|  |\n| ------- |\n| [0013-roman-to-integer](https://github.com/any/tree/master/0013-roman-to-integer) |\n| [0002-fake-problem](https://github.com/any/tree/master/0002-fake-problem) |\n| [0012-fake-problem](https://github.com/any/tree/master/0012-fake-problem) |\n| [0009-fake-problem](https://github.com/any/tree/master/0009-fake-problem) |\n| [0090-fake-problem](https://github.com/any/tree/master/0090-fake-problem) |\n| [0020-fake-problem](https://github.com/any/tree/master/0020-fake-problem) |\n\n<!---LeetCode Topics End-->';
    expect(output).toBe(expected);
  });
});

describe('getFallbackTopic', () => {
  it('should return explicit string fallback category when passed a string', () => {
    expect(getFallbackTopic('Pandas')).toBe('Pandas');
    expect(getFallbackTopic('Python')).toBe('Python');
    expect(getFallbackTopic('Untagged/Others')).toBe('Untagged/Others');
  });

  it('should return Pandas when categoryTitle or category is Pandas', () => {
    expect(getFallbackTopic({ categoryTitle: 'Pandas' })).toBe('Pandas');
    expect(getFallbackTopic({ category: 'Pandas' })).toBe('Pandas');
  });

  it('should return Pandas when language indicates Pandas', () => {
    expect(getFallbackTopic({ language: 'Pandas' })).toBe('Pandas');
    expect(getFallbackTopic({ lang: { verboseName: 'Pandas' } })).toBe('Pandas');
    expect(getFallbackTopic({ lang: { name: 'pandas' } })).toBe('Pandas');
  });

  it('should return Python when language is Python or Python3', () => {
    expect(getFallbackTopic({ language: 'Python' })).toBe('Python');
    expect(getFallbackTopic({ language: 'Python3' })).toBe('Python');
    expect(getFallbackTopic({ language: '.py' })).toBe('Python');
    expect(getFallbackTopic({ lang: { verboseName: 'Python3' } })).toBe('Python');
  });

  it('should return Database when category or language indicates SQL/Database', () => {
    expect(getFallbackTopic({ categoryTitle: 'Database' })).toBe('Database');
    expect(getFallbackTopic({ language: 'MySQL' })).toBe('Database');
    expect(getFallbackTopic({ language: 'MS SQL Server' })).toBe('Database');
  });

  it('should return custom non-algorithm categoryTitle', () => {
    expect(getFallbackTopic({ categoryTitle: 'JavaScript' })).toBe('JavaScript');
    expect(getFallbackTopic({ categoryTitle: 'Shell' })).toBe('Shell');
  });

  it('should ignore Algorithms categoryTitle and fall back to language or default topic', () => {
    expect(getFallbackTopic({ categoryTitle: 'Algorithms', language: 'Pandas' })).toBe('Pandas');
    expect(getFallbackTopic({ categoryTitle: 'Algorithms' })).toBe(DEFAULT_FALLBACK_TOPIC);
  });

  it('should return Untagged/Others when no options or empty object is passed', () => {
    expect(getFallbackTopic()).toBe(DEFAULT_FALLBACK_TOPIC);
    expect(getFallbackTopic({})).toBe(DEFAULT_FALLBACK_TOPIC);
    expect(getFallbackTopic(null)).toBe(DEFAULT_FALLBACK_TOPIC);
  });

  it('should respect custom defaultTopic option', () => {
    expect(getFallbackTopic({ defaultTopic: 'Others' })).toBe('Others');
  });
});

describe('getTopicTags', () => {
  it('should return existing topic tags when valid topicTags are provided', () => {
    const tags = [{ name: 'Array', slug: 'array' }, { name: 'Hash Table', slug: 'hash-table' }];
    const result = getTopicTags(tags);
    expect(result).toEqual([{ name: 'Array' }, { name: 'Hash Table' }]);
  });

  it('should support array of topic string names', () => {
    const tags = ['Dynamic Programming', 'Math'];
    const result = getTopicTags(tags);
    expect(result).toEqual([{ name: 'Dynamic Programming' }, { name: 'Math' }]);
  });

  it('should filter out empty, null, or whitespace tag names', () => {
    const tags = [{ name: '' }, null, { name: 'String' }, { name: '   ' }];
    const result = getTopicTags(tags);
    expect(result).toEqual([{ name: 'String' }]);
  });

  it('should fall back to Pandas when topicTags is empty array and problem is Pandas', () => {
    const result = getTopicTags([], { categoryTitle: 'Pandas' });
    expect(result).toEqual([{ name: 'Pandas' }]);

    const resultFromLang = getTopicTags([], { language: 'Pandas' });
    expect(resultFromLang).toEqual([{ name: 'Pandas' }]);
  });

  it('should fall back to Python when topicTags is null and language is Python', () => {
    const result = getTopicTags(null, { language: 'Python3' });
    expect(result).toEqual([{ name: 'Python' }]);
  });

  it('should fall back to Untagged/Others when topicTags is null or empty without context', () => {
    expect(getTopicTags(null)).toEqual([{ name: 'Untagged/Others' }]);
    expect(getTopicTags([])).toEqual([{ name: 'Untagged/Others' }]);
    expect(getTopicTags([null])).toEqual([{ name: 'Untagged/Others' }]);
  });

  it('should support string fallback options directly', () => {
    const result = getTopicTags([], 'Pandas');
    expect(result).toEqual([{ name: 'Pandas' }]);
  });
});

describe('README topic table integration for Pandas and Untagged problems', () => {
  const initialReadme =
    '# Repository Notes\n<!---LeetCode Topics Start-->\n# LeetCode Topics\n<!---LeetCode Topics End-->';

  it('should safely add Pandas problem under ## Pandas section in root README', () => {
    const topics = getTopicTags([], { categoryTitle: 'Pandas' });
    let readme = initialReadme;
    for (const topic of topics) {
      readme = appendProblemToReadme(
        topic.name,
        readme,
        'user/repo',
        '2877-create-a-dataframe-from-list'
      );
    }
    readme = sortTopicsInReadme(readme);

    expect(readme).toContain('## Pandas');
    expect(readme).toContain(
      '| [2877-create-a-dataframe-from-list](https://github.com/user/repo/tree/master/2877-create-a-dataframe-from-list) |'
    );
  });

  it('should safely add untagged problem under ## Untagged/Others section in root README', () => {
    const topics = getTopicTags(null);
    let readme = initialReadme;
    for (const topic of topics) {
      readme = appendProblemToReadme(topic.name, readme, 'user/repo', '0100-same-tree');
    }
    readme = sortTopicsInReadme(readme);

    expect(readme).toContain('## Untagged/Others');
    expect(readme).toContain(
      '| [0100-same-tree](https://github.com/user/repo/tree/master/0100-same-tree) |'
    );
  });

  it('should correctly sort multiple problems under fallback section numerically', () => {
    let readme = initialReadme;
    readme = appendProblemToReadme(
      'Pandas',
      readme,
      'user/repo',
      '2878-get-the-size-of-a-dataframe'
    );
    readme = appendProblemToReadme(
      'Pandas',
      readme,
      'user/repo',
      '2877-create-a-dataframe-from-list'
    );
    readme = appendProblemToReadme(
      'Pandas',
      readme,
      'user/repo',
      '2880-select-data'
    );
    readme = sortTopicsInReadme(readme);

    const index2877 = readme.indexOf('2877-create-a-dataframe-from-list');
    const index2878 = readme.indexOf('2878-get-the-size-of-a-dataframe');
    const index2880 = readme.indexOf('2880-select-data');

    expect(index2877).toBeLessThan(index2878);
    expect(index2878).toBeLessThan(index2880);
  });

  it('should co-exist with existing DSA topic sections without corrupting order', () => {
    let readme = initialReadme;
    readme = appendProblemToReadme('Array', readme, 'user/repo', '0001-two-sum');
    readme = appendProblemToReadme(
      'Pandas',
      readme,
      'user/repo',
      '2877-create-a-dataframe-from-list'
    );
    readme = appendProblemToReadme('Untagged/Others', readme, 'user/repo', '0050-powx-n');
    readme = sortTopicsInReadme(readme);

    expect(readme).toContain('## Array');
    expect(readme).toContain('## Pandas');
    expect(readme).toContain('## Untagged/Others');
  });
});
