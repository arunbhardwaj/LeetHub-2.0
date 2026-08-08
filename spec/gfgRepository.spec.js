import {
  createEmptyRepositoryIndex,
  finalizeRepositoryProblem,
  generateRootReadme,
  getVisibleProblemSlug,
  reserveRepositoryProblem,
} from '../scripts/gfg/repository.js';

function problem(overrides = {}) {
  return {
    title: overrides.title ?? 'Who Will Win',
    slug: overrides.slug ?? 'who-will-win-1587115621',
    difficulty: overrides.difficulty ?? 'easy',
    url: overrides.url ?? 'https://www.geeksforgeeks.org/problems/who-will-win-1587115621/1',
    tags: overrides.tags ?? ['Array', 'Binary Search'],
  };
}

describe('GFG repository index', () => {
  it('removes only the known 10-digit GFG suffix from visible folder slugs', () => {
    expect(getVisibleProblemSlug('who-will-win-1587115621')).toBe('who-will-win');
    expect(getVisibleProblemSlug('two-sum-2')).toBe('two-sum-2');
  });

  it('persists numbering, never renumbers, and assigns the next problem', () => {
    let index = createEmptyRepositoryIndex();
    const first = reserveRepositoryProblem(index, problem());
    index = first.index;
    const repeated = reserveRepositoryProblem(index, problem());
    index = repeated.index;
    const second = reserveRepositoryProblem(
      index,
      problem({ title: 'Reverse Array', slug: 'reverse-array-1587115622' })
    );

    expect(first.entry.directory).toBe('0001-who-will-win');
    expect(repeated.entry.directory).toBe('0001-who-will-win');
    expect(second.entry.directory).toBe('0002-reverse-array');
    expect(second.index.nextNumber).toBe(3);
  });

  it('generates one root row with all languages and reliable topics', () => {
    let index = reserveRepositoryProblem(createEmptyRepositoryIndex(), problem()).index;
    index = finalizeRepositoryProblem(index, problem(), ['java']).index;
    index = finalizeRepositoryProblem(index, problem(), ['cpp']).index;
    index = finalizeRepositoryProblem(
      index,
      problem({ title: 'Reverse Array', slug: 'reverse-array-1587115622', tags: ['Array'] }),
      ['python']
    ).index;

    const readme = generateRootReadme(index);
    expect(readme).toContain('| 1 | [Who Will Win](./0001-who-will-win) | Easy | Java, C++ |');
    expect(readme.match(/Who Will Win/g).length).toBe(1);
    expect(readme).toContain('| 2 | [Reverse Array](./0002-reverse-array) | Easy | Python |');
    expect(readme).toContain('### Array\n\n- [0001-who-will-win](./0001-who-will-win)');
    expect(readme).toContain('### Binary Search');
  });
});
