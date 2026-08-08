import {
  createRepository,
  getStoredSetup,
  GitHubSetupError,
  listWritableRepositories,
  normalizeRepositoryName,
  saveRepository,
  validateGitHubConnection,
  validateRepository,
} from '../scripts/core/githubSetup.js';
import { STORAGE_KEYS } from '../scripts/core/storage.js';

function response(status, body = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return body;
    },
  };
}

function memoryBrowser(initial = {}) {
  const values = structuredClone(initial);
  return {
    values,
    storage: {
      local: {
        async get(keys) {
          const requested = Array.isArray(keys) ? keys : [keys];
          return Object.fromEntries(
            requested.filter(key => values[key] !== undefined).map(key => [key, values[key]])
          );
        },
        async set(next) {
          Object.assign(values, structuredClone(next));
        },
      },
    },
  };
}

describe('GitHub setup', () => {
  it('reports a fresh install as setup required without exposing a token', async () => {
    const setup = await getStoredSetup(memoryBrowser());
    expect(setup.token).toBeNull();
    expect(setup.repository).toBeNull();
    expect(setup.mode).toBeNull();
  });

  it('validates a connected GitHub user and rejects bad authentication clearly', async () => {
    const user = await validateGitHubConnection('token', {
      fetchImpl: async () => response(200, { login: 'octocat' }),
    });
    expect(user.login).toBe('octocat');

    await expectAsync(
      validateGitHubConnection('bad-token', { fetchImpl: async () => response(401) })
    ).toBeRejectedWithError(GitHubSetupError, 'authentication_failed');
  });

  it('lists only existing repositories with write access', async () => {
    const repositories = await listWritableRepositories('token', {
      fetchImpl: async () =>
        response(200, [
          {
            full_name: 'octocat/writable',
            html_url: 'https://github.com/octocat/writable',
            permissions: { push: true },
          },
          {
            full_name: 'octocat/read-only',
            html_url: 'https://github.com/octocat/read-only',
            permissions: { push: false },
          },
        ]),
    });
    expect(repositories.map(repository => repository.fullName)).toEqual(['octocat/writable']);
  });

  it('validates write permission before saving and survives a later reopen', async () => {
    const stats = { solved: 7, easy: 3, medium: 3, hard: 1, shas: {}, solvedSlugs: [] };
    const api = memoryBrowser({ [STORAGE_KEYS.STATS]: stats });
    const repository = await validateRepository('token', 'octocat/gfg-solutions', {
      fetchImpl: async () =>
        response(200, {
          full_name: 'octocat/gfg-solutions',
          html_url: 'https://github.com/octocat/gfg-solutions',
          permissions: { maintain: true },
        }),
    });
    await saveRepository(api, repository);

    const reopened = await getStoredSetup(api);
    expect(reopened.repository).toBe('octocat/gfg-solutions');
    expect(reopened.mode).toBe('commit');
    expect(reopened.stats).toEqual(stats);
  });

  it('changes repository without resetting stats', async () => {
    const stats = { solved: 4, easy: 2, medium: 1, hard: 1 };
    const api = memoryBrowser({
      [STORAGE_KEYS.REPOSITORY]: 'octocat/old',
      [STORAGE_KEYS.MODE]: 'commit',
      [STORAGE_KEYS.STATS]: stats,
    });
    await saveRepository(api, {
      fullName: 'octocat/new',
      htmlUrl: 'https://github.com/octocat/new',
    });

    expect(api.values[STORAGE_KEYS.REPOSITORY]).toBe('octocat/new');
    expect(api.values[STORAGE_KEYS.STATS]).toEqual(stats);
  });

  it('does not replace a working repository when validation fails', async () => {
    const api = memoryBrowser({
      [STORAGE_KEYS.REPOSITORY]: 'octocat/working',
      [STORAGE_KEYS.MODE]: 'commit',
    });
    await expectAsync(
      validateRepository('token', 'octocat/missing', {
        fetchImpl: async () => response(404),
      })
    ).toBeRejectedWithError(GitHubSetupError, 'repository_not_found');
    expect(api.values[STORAGE_KEYS.REPOSITORY]).toBe('octocat/working');
  });

  it('handles forbidden, non-writable, invalid, and network repository checks', async () => {
    expect(() => normalizeRepositoryName('not a repo', 'octocat')).toThrowError(
      GitHubSetupError,
      'invalid_repository'
    );
    await expectAsync(
      validateRepository('token', 'octocat/private', {
        fetchImpl: async () => response(403),
      })
    ).toBeRejectedWithError(GitHubSetupError, 'repository_forbidden');
    await expectAsync(
      validateRepository('token', 'octocat/read-only', {
        fetchImpl: async () =>
          response(200, {
            full_name: 'octocat/read-only',
            html_url: 'https://github.com/octocat/read-only',
            permissions: { push: false },
          }),
      })
    ).toBeRejectedWithError(GitHubSetupError, 'repository_not_writable');
    await expectAsync(
      validateRepository('token', 'octocat/network', {
        fetchImpl: async () => {
          throw new TypeError('offline');
        },
      })
    ).toBeRejectedWithError(GitHubSetupError, 'network_failure');
  });

  it('creates and re-validates a private repository before it can be saved', async () => {
    const calls = [];
    const repository = await createRepository('token', 'gfg-solutions', {
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        if (options.method === 'POST') {
          return response(201, { full_name: 'octocat/gfg-solutions' });
        }
        return response(200, {
          full_name: 'octocat/gfg-solutions',
          html_url: 'https://github.com/octocat/gfg-solutions',
          private: true,
          permissions: { admin: true },
        });
      },
    });
    expect(repository.fullName).toBe('octocat/gfg-solutions');
    expect(calls.length).toBe(2);
    expect(JSON.parse(calls[0].options.body).private).toBeTrue();
  });
});
