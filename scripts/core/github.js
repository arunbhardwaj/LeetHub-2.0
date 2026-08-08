import { getGitHubConnection, updateStats } from './storage.js';

const GITHUB_API_URL = 'https://api.github.com';

class GitHubError extends Error {
  constructor(status, response) {
    super(String(status));
    this.name = 'GitHubError';
    this.status = status;
    this.response = response;
  }
}

function getPath(directory, filename) {
  return [directory, filename].filter(Boolean).join('/');
}

function encodeContent(content) {
  return btoa(unescape(encodeURIComponent(content)));
}

function decodeContent(content) {
  return decodeURIComponent(escape(atob(content)));
}

function getHeaders(token) {
  return {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

function validateConnection(connection) {
  if (!connection.token) {
    throw new GitHubError('LeethubTokenUndefined');
  }
  if (connection.mode !== 'commit') {
    throw new GitHubError('GitHubNotAuthorized');
  }
  if (!connection.repository) {
    throw new GitHubError('NoRepoDefined');
  }
  return connection;
}

async function getGitHubFile(token, repository, directory, filename) {
  const path = getPath(directory, filename);
  const response = await fetch(`${GITHUB_API_URL}/repos/${repository}/contents/${path}`, {
    method: 'GET',
    headers: getHeaders(token),
  });

  if (!response.ok) {
    throw new GitHubError(response.status, response);
  }

  return response;
}

async function uploadFile(token, repository, content, directory, filename, sha, message) {
  const path = getPath(directory, filename);
  const data = { message, content };
  if (sha) {
    data.sha = sha;
  }

  const response = await fetch(`${GITHUB_API_URL}/repos/${repository}/contents/${path}`, {
    method: 'PUT',
    headers: getHeaders(token),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new GitHubError(response.status, response);
  }

  const body = await response.json();
  await updateStats(stats => {
    stats.shas[directory] ??= {};
    stats.shas[directory][filename] = body.content.sha;
    return stats;
  });

  return body.content.sha;
}

async function deleteFile(token, repository, directory, filename, sha, message) {
  const path = getPath(directory, filename);
  const response = await fetch(`${GITHUB_API_URL}/repos/${repository}/contents/${path}`, {
    method: 'DELETE',
    headers: getHeaders(token),
    body: JSON.stringify({ message, sha }),
  });

  if (!response.ok) throw new GitHubError(response.status, response);
}

async function syncGitHubFile(
  content,
  directory,
  filename,
  { createMessage, updateMessage },
  options = {}
) {
  const connection = validateConnection(
    options.connection ?? (await (options.getConnection ?? getGitHubConnection)())
  );
  const readFile = options.getFile ?? getGitHubFile;
  const writeFile = options.writeFile ?? uploadFile;

  const readCurrent = async () => {
    try {
      const response = await readFile(connection.token, connection.repository, directory, filename);
      const body = typeof response.json === 'function' ? await response.json() : response;
      return {
        sha: body.sha,
        content: decodeContent(String(body.content ?? '').replace(/\s+/g, '')),
      };
    } catch (error) {
      if (error instanceof GitHubError && error.status === 404) return null;
      throw error;
    }
  };

  const write = (sha, message) =>
    writeFile(
      connection.token,
      connection.repository,
      encodeContent(content),
      directory,
      filename,
      sha,
      message
    );

  let current = await readCurrent();
  if (current?.content === content) {
    return Object.freeze({ action: 'unchanged', sha: current.sha });
  }

  try {
    const sha = await write(current?.sha ?? '', current ? updateMessage : createMessage);
    return Object.freeze({ action: current ? 'updated' : 'created', sha });
  } catch (error) {
    if (!(error instanceof GitHubError) || ![409, 422].includes(error.status)) {
      throw error;
    }

    current = await readCurrent();
    if (current?.content === content) {
      return Object.freeze({ action: 'unchanged', sha: current.sha });
    }
    if (!current) throw error;

    const sha = await write(current.sha, updateMessage);
    return Object.freeze({ action: 'updated', sha });
  }
}

async function prepareGitHubDirectoryMigration(
  sourceDirectory,
  targetDirectory,
  messages,
  options = {}
) {
  if (!sourceDirectory || sourceDirectory === targetDirectory) {
    return { migratedLanguages: [], cleanup: async () => ({ status: 'not_needed' }) };
  }

  const connection = validateConnection(
    options.connection ?? (await (options.getConnection ?? getGitHubConnection)())
  );
  const readFile = options.getFile ?? getGitHubFile;
  const syncFile = options.syncFile ?? syncGitHubFile;
  const removeFile = options.deleteFile ?? deleteFile;
  let response;
  try {
    response = await readFile(connection.token, connection.repository, sourceDirectory, '');
  } catch (error) {
    if (error instanceof GitHubError && error.status === 404) {
      return { migratedLanguages: [], cleanup: async () => ({ status: 'not_found' }) };
    }
    throw error;
  }

  const entries = typeof response.json === 'function' ? await response.json() : response;
  if (!Array.isArray(entries) || entries.some(entry => entry.type !== 'file')) {
    return { migratedLanguages: [], cleanup: async () => ({ status: 'unsafe_structure' }) };
  }

  const copied = [];
  for (const entry of entries) {
    if (entry.name === 'README.md') continue;
    const fileResponse = await readFile(
      connection.token,
      connection.repository,
      sourceDirectory,
      entry.name
    );
    const body = typeof fileResponse.json === 'function' ? await fileResponse.json() : fileResponse;
    const content = decodeContent(String(body.content ?? '').replace(/\s+/g, ''));
    await syncFile(content, targetDirectory, entry.name, messages);
    copied.push(entry.name);
  }

  return {
    copied,
    async cleanup() {
      for (const entry of entries) {
        await removeFile(
          connection.token,
          connection.repository,
          sourceDirectory,
          entry.name,
          entry.sha,
          messages.deleteMessage
        );
      }
      return { status: 'migrated', deleted: entries.map(entry => entry.name) };
    },
  };
}

export {
  decodeContent,
  deleteFile,
  encodeContent,
  getGitHubFile,
  GitHubError,
  prepareGitHubDirectoryMigration,
  syncGitHubFile,
  uploadFile,
};
