import { STORAGE_KEYS } from './storage.js';

const GITHUB_API_URL = 'https://api.github.com';

class GitHubSetupError extends Error {
  constructor(code, status = null) {
    super(code);
    this.name = 'GitHubSetupError';
    this.code = code;
    this.status = status;
  }
}

function headers(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

function setupError(status) {
  if (status === 401) return new GitHubSetupError('authentication_failed', status);
  if (status === 403) return new GitHubSetupError('repository_forbidden', status);
  if (status === 404) return new GitHubSetupError('repository_not_found', status);
  return new GitHubSetupError('github_request_failed', status);
}

async function githubRequest(path, options = {}) {
  const request = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await request(`${GITHUB_API_URL}${path}`, {
      ...options.request,
      headers: {
        ...headers(options.token),
        ...options.request?.headers,
      },
    });
  } catch (_error) {
    throw new GitHubSetupError('network_failure');
  }

  if (!response.ok) throw setupError(response.status);
  return response.json();
}

function hasWriteAccess(repository) {
  const permissions = repository?.permissions;
  return Boolean(permissions?.push || permissions?.maintain || permissions?.admin);
}

function normalizeRepositoryName(value, username = '') {
  const input = String(value ?? '').trim();
  const fullName = input.includes('/') ? input : username ? `${username}/${input}` : '';
  const parts = fullName.split('/');
  if (parts.length !== 2 || parts.some(part => !part || !/^[A-Za-z0-9_.-]+$/.test(part))) {
    throw new GitHubSetupError('invalid_repository');
  }
  return fullName;
}

async function validateGitHubConnection(token, options = {}) {
  if (!token) throw new GitHubSetupError('not_connected');
  return githubRequest('/user', { ...options, token });
}

async function listWritableRepositories(token, options = {}) {
  const repositories = await githubRequest(
    '/user/repos?affiliation=owner%2Ccollaborator%2Corganization_member&per_page=100&sort=updated',
    { ...options, token }
  );
  return repositories.filter(hasWriteAccess).map(repository => ({
    fullName: repository.full_name,
    htmlUrl: repository.html_url,
    private: Boolean(repository.private),
  }));
}

async function validateRepository(token, name, options = {}) {
  const fullName = normalizeRepositoryName(name, options.username);
  const [owner, repository] = fullName.split('/').map(encodeURIComponent);
  const result = await githubRequest(`/repos/${owner}/${repository}`, { ...options, token });
  if (!hasWriteAccess(result)) {
    throw new GitHubSetupError('repository_not_writable', 403);
  }
  return {
    fullName: result.full_name,
    htmlUrl: result.html_url,
    private: Boolean(result.private),
  };
}

async function createRepository(token, name, options = {}) {
  const repositoryName = String(name ?? '').trim();
  if (!repositoryName || !/^[A-Za-z0-9_.-]+$/.test(repositoryName)) {
    throw new GitHubSetupError('invalid_repository');
  }
  const created = await githubRequest('/user/repos', {
    ...options,
    token,
    request: {
      method: 'POST',
      body: JSON.stringify({
        name: repositoryName,
        private: true,
        auto_init: true,
        description: 'A collection of GeeksforGeeks solutions synced by GFGHub',
      }),
    },
  });
  return validateRepository(token, created.full_name, options);
}

async function saveRepository(api, repository) {
  await api.storage.local.set({
    [STORAGE_KEYS.MODE]: 'commit',
    [STORAGE_KEYS.REPOSITORY]: repository.fullName,
    repo: repository.htmlUrl,
  });
  return repository;
}

async function getStoredSetup(api) {
  const values = await api.storage.local.get([
    STORAGE_KEYS.TOKEN,
    STORAGE_KEYS.USERNAME,
    STORAGE_KEYS.REPOSITORY,
    STORAGE_KEYS.MODE,
    STORAGE_KEYS.STATS,
    'github_auth_status',
  ]);
  return {
    token: values[STORAGE_KEYS.TOKEN] ?? null,
    username: values[STORAGE_KEYS.USERNAME] ?? null,
    repository: values[STORAGE_KEYS.REPOSITORY] ?? null,
    mode: values[STORAGE_KEYS.MODE] ?? null,
    stats: values[STORAGE_KEYS.STATS] ?? null,
    authStatus: values.github_auth_status ?? null,
  };
}

export {
  createRepository,
  getStoredSetup,
  GitHubSetupError,
  hasWriteAccess,
  listWritableRepositories,
  normalizeRepositoryName,
  saveRepository,
  validateGitHubConnection,
  validateRepository,
};
