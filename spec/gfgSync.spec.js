import { GitHubError } from '../scripts/core/github.js';
import {
  createAcceptedSubmissionSync,
  generateProblemReadme,
  normalizeSyncError,
} from '../scripts/gfg/sync.js';
import {
  createEmptyRepositoryIndex,
  finalizeRepositoryProblem,
  reserveRepositoryProblem,
} from '../scripts/gfg/repository.js';

function submission({
  attemptId = 'problem-a/1:1',
  verdict = 'accepted',
  slug = 'problem-a',
  title = 'Problem A',
  difficulty = 'easy',
  statement = 'Solve Problem A.',
  tags = [],
  code = 'Code A',
  language = 'java',
  extension = '.java',
} = {}) {
  return {
    attemptId,
    verdict,
    problem: {
      title,
      slug,
      routeKey: `${slug}/1`,
      url: `https://www.geeksforgeeks.org/problems/${slug}/1`,
      difficulty,
      statement,
      tags,
    },
    solution: { code, language, extension },
  };
}

function fakeRepository() {
  const files = new Map();
  const calls = [];
  return {
    files,
    calls,
    async syncFile(content, directory, filename, messages) {
      const path = [directory, filename].filter(Boolean).join('/');
      const previous = files.get(path);
      const action =
        previous === undefined ? 'created' : previous === content ? 'unchanged' : 'updated';
      files.set(path, content);
      calls.push({ path, content, messages, action });
      return { action, sha: `${path}:${calls.length}` };
    },
  };
}

function createFakeSync(repository) {
  let index = createEmptyRepositoryIndex();
  return createAcceptedSubmissionSync({
    syncFile: repository.syncFile,
    recordSync: async () => {},
    reserveProblem: async problem => {
      const reserved = reserveRepositoryProblem(index, problem);
      index = reserved.index;
      return reserved;
    },
    finalizeProblem: async (problem, languages) => {
      const finalized = finalizeRepositoryProblem(index, problem, languages);
      index = finalized.index;
      return finalized;
    },
    prepareMigration: async () => ({
      copied: [],
      cleanup: async () => ({ status: 'not_found' }),
    }),
  });
}

describe('accepted GFG submission sync', () => {
  it('does absolutely no GitHub work for failure verdicts', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);

    for (const verdict of [
      'wrong_answer',
      'compilation_error',
      'time_limit_exceeded',
      'runtime_error',
    ]) {
      const result = await sync(submission({ attemptId: verdict, verdict }));
      expect(result.status).toBe('skipped');
    }

    expect(repository.calls.length).toBe(0);
  });

  it('does not upload an Accepted attempt with a missing source snapshot', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    const result = await sync(submission({ code: '' }));

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('source_code_missing');
    expect(repository.calls.length).toBe(0);
  });

  it('creates README.md and Solution.java for Accepted Java', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    const result = await sync(submission());

    expect(result.status).toBe('synced');
    expect(repository.files.has('0001-problem-a/README.md')).toBeTrue();
    expect(repository.files.get('0001-problem-a/Solution.java')).toBe('Code A');
    expect(repository.files.get('0001-problem-a/README.md')).toContain('# Problem A');
    expect(repository.files.get('0001-problem-a/README.md')).toContain('**Difficulty:** Easy');
    expect(repository.files.get('0001-problem-a/README.md')).toContain('## Problem Statement');
    expect(repository.files.get('README.md')).toContain(
      '| 1 | [Problem A](./0001-problem-a) | Easy | Java |'
    );
  });

  it('creates Solution.cpp without overwriting an existing Java solution', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    await sync(submission());
    await sync(
      submission({
        attemptId: 'problem-a/1:2',
        code: 'Cpp Code',
        language: 'cpp',
        extension: '.cpp',
      })
    );

    expect(repository.files.get('0001-problem-a/Solution.java')).toBe('Code A');
    expect(repository.files.get('0001-problem-a/Solution.cpp')).toBe('Cpp Code');
    expect(repository.files.get('README.md')).toContain('Java, C++');
  });

  it('updates the stable Java filename on a later Accepted attempt', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    await sync(submission());
    const result = await sync(submission({ attemptId: 'problem-a/1:2', code: 'Updated Code A' }));

    expect(repository.files.get('0001-problem-a/Solution.java')).toBe('Updated Code A');
    expect(repository.files.has('0001-problem-a/Solution2.java')).toBeFalse();
    expect(result.files.find(file => file.path.endsWith('Solution.java')).action).toBe('updated');
  });

  it('returns unchanged and creates no useful update for identical content', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    await sync(submission());
    const result = await sync(submission({ attemptId: 'problem-a/1:2' }));

    expect(result.status).toBe('unchanged');
    expect(result.files.every(file => file.action === 'unchanged')).toBeTrue();
  });

  it('keeps different problems in separate folders', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    await sync(submission());
    await sync(
      submission({
        attemptId: 'problem-b/1:2',
        slug: 'problem-b',
        title: 'Problem B',
        code: 'Code B',
      })
    );

    expect(repository.files.get('0001-problem-a/Solution.java')).toBe('Code A');
    expect(repository.files.get('0002-problem-b/Solution.java')).toBe('Code B');
  });

  it('uploads the submission-time snapshot exactly, not later editor content', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    let editorContents = 'Code A';
    const captured = submission({ code: editorContents });
    editorContents = 'Code B';
    await sync(captured);

    expect(repository.files.get('0001-problem-a/Solution.java')).toBe('Code A');
    expect(repository.files.get('0001-problem-a/Solution.java')).not.toBe(editorContents);
  });

  it('deduplicates repeated result delivery for the same attempt ID', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    const accepted = submission();
    const [first, second] = await Promise.all([sync(accepted), sync(accepted)]);

    expect(first).toBe(second);
    expect(repository.calls.length).toBe(3);
  });

  it('omits unavailable optional README sections', () => {
    const readme = generateProblemReadme({
      title: 'Problem A',
      url: 'https://www.geeksforgeeks.org/problems/problem-a/1',
      difficulty: null,
      statement: null,
    });

    expect(readme).not.toContain('Difficulty');
    expect(readme).not.toContain('Problem Statement');
    expect(readme).not.toContain('null');
    expect(readme).not.toContain('undefined');
  });

  it('adds reliable GFG topic metadata to the problem README', () => {
    const readme = generateProblemReadme({
      title: 'Problem A',
      url: 'https://www.geeksforgeeks.org/problems/problem-a/1',
      difficulty: 'easy',
      statement: 'Solve it.',
      tags: ['Array', 'Binary Search'],
    });

    expect(readme).toContain('**Topics:** Array, Binary Search');
    expect(readme).not.toContain('[object Object]');
  });

  it('uses GFG commit messages and sanitizes the directory', async () => {
    const repository = fakeRepository();
    const sync = createFakeSync(repository);
    const unsafeSlug = submission({ slug: '../Problem A\\unsafe' });
    unsafeSlug.problem.url = 'https://www.geeksforgeeks.org/problems/problem-a/1';
    await sync(unsafeSlug);

    expect(repository.calls[0].path).toBe('0001-problem-a-unsafe/Solution.java');
    expect(repository.calls[0].messages.createMessage).toBe('Add Problem A solution');
    expect(repository.calls[0].messages.createMessage).not.toContain('Leet');
  });

  it('reports GitHub authentication and API errors without throwing', async () => {
    const repository = fakeRepository();
    repository.syncFile = async () => {
      throw new GitHubError(401);
    };
    const sync = createFakeSync(repository);
    const result = await sync(submission());

    expect(result.status).toBe('failed');
    expect(result.reason).toBe('authentication_failed');
  });

  it('does not crash or record stats when an Accepted result has no repository', async () => {
    let recorded = false;
    const repository = fakeRepository();
    repository.syncFile = async () => {
      throw new GitHubError('NoRepoDefined');
    };
    let index = createEmptyRepositoryIndex();
    const sync = createAcceptedSubmissionSync({
      syncFile: repository.syncFile,
      recordSync: async () => {
        recorded = true;
      },
      reserveProblem: async problem => {
        const reserved = reserveRepositoryProblem(index, problem);
        index = reserved.index;
        return reserved;
      },
      finalizeProblem: async (problem, languages) => {
        const finalized = finalizeRepositoryProblem(index, problem, languages);
        index = finalized.index;
        return finalized;
      },
      prepareMigration: async () => ({
        copied: [],
        cleanup: async () => ({ status: 'not_found' }),
      }),
    });

    const result = await sync(submission());
    expect(result.status).toBe('failed');
    expect(result.reason).toBe('repository_not_selected');
    expect(result.files).toEqual([]);
    expect(recorded).toBeFalse();
  });

  it('normalizes configured-repository, API, rate-limit, and network failures', () => {
    expect(normalizeSyncError(new GitHubError('LeethubTokenUndefined'))).toBe(
      'github_not_authenticated'
    );
    expect(normalizeSyncError(new GitHubError('NoRepoDefined'))).toBe('repository_not_selected');
    expect(normalizeSyncError(new GitHubError('GitHubNotAuthorized'))).toBe('github_not_connected');
    expect(normalizeSyncError(new GitHubError(403))).toBe('permission_denied');
    expect(normalizeSyncError(new GitHubError(403, { headers: { get: () => '0' } }))).toBe(
      'rate_limited'
    );
    expect(normalizeSyncError(new GitHubError(429))).toBe('rate_limited');
    expect(normalizeSyncError(new GitHubError(404))).toBe('repository_not_found');
    expect(normalizeSyncError(new GitHubError(409))).toBe('conflict');
    expect(normalizeSyncError(new GitHubError(422))).toBe('validation_failed');
    expect(normalizeSyncError(new TypeError('network down'))).toBe('network_failure');
  });
});
