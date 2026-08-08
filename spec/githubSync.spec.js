import {
  encodeContent,
  GitHubError,
  prepareGitHubDirectoryMigration,
  syncGitHubFile,
} from '../scripts/core/github.js';

const connection = {
  token: 'test-token',
  repository: 'owner/repository',
  mode: 'commit',
};

describe('shared GitHub file sync', () => {
  const messages = {
    createMessage: 'Add solution',
    updateMessage: 'Update solution',
  };

  it('creates a missing file without a SHA', async () => {
    const writes = [];
    const result = await syncGitHubFile('Code A', 'problem-a', 'Solution.java', messages, {
      connection,
      getFile: async () => {
        throw new GitHubError(404);
      },
      writeFile: async (...args) => {
        writes.push(args);
        return 'created-sha';
      },
    });

    expect(result).toEqual({ action: 'created', sha: 'created-sha' });
    expect(writes.length).toBe(1);
    expect(writes[0][2]).toBe(encodeContent('Code A'));
    expect(writes[0][5]).toBe('');
    expect(writes[0][6]).toBe('Add solution');
  });

  it('updates an existing file using its current SHA', async () => {
    const writes = [];
    const result = await syncGitHubFile('Code B', 'problem-a', 'Solution.java', messages, {
      connection,
      getFile: async () => ({
        async json() {
          return { content: encodeContent('Code A'), sha: 'old-sha' };
        },
      }),
      writeFile: async (...args) => {
        writes.push(args);
        return 'new-sha';
      },
    });

    expect(result).toEqual({ action: 'updated', sha: 'new-sha' });
    expect(writes[0][5]).toBe('old-sha');
    expect(writes[0][6]).toBe('Update solution');
  });

  it('does not write when existing content is identical', async () => {
    let writes = 0;
    const result = await syncGitHubFile('Code A', 'problem-a', 'Solution.java', messages, {
      connection,
      getFile: async () => ({
        async json() {
          return { content: encodeContent('Code A'), sha: 'same-sha' };
        },
      }),
      writeFile: async () => {
        writes++;
      },
    });

    expect(result).toEqual({ action: 'unchanged', sha: 'same-sha' });
    expect(writes).toBe(0);
  });

  it('performs no GitHub read or write when no repository is selected', async () => {
    let requests = 0;
    await expectAsync(
      syncGitHubFile('Code A', 'problem-a', 'Solution.java', messages, {
        connection: { ...connection, repository: null },
        getFile: async () => {
          requests++;
        },
        writeFile: async () => {
          requests++;
        },
      })
    ).toBeRejectedWithError(GitHubError, 'NoRepoDefined');
    expect(requests).toBe(0);
  });

  it('re-reads and retries an update after a create conflict', async () => {
    let reads = 0;
    const writes = [];
    const result = await syncGitHubFile('Code B', 'problem-a', 'Solution.java', messages, {
      connection,
      getFile: async () => {
        reads++;
        if (reads === 1) throw new GitHubError(404);
        return { content: encodeContent('Code A'), sha: 'race-sha' };
      },
      writeFile: async (...args) => {
        writes.push(args);
        if (writes.length === 1) throw new GitHubError(422);
        return 'resolved-sha';
      },
    });

    expect(result.action).toBe('updated');
    expect(writes[1][5]).toBe('race-sha');
  });

  it('copies legacy folder files before deleting the verified originals', async () => {
    const copied = [];
    const deleted = [];
    const entries = [
      { type: 'file', name: 'README.md', sha: 'readme-sha' },
      { type: 'file', name: 'Solution.java', sha: 'java-sha' },
      { type: 'file', name: 'Solution.cpp', sha: 'cpp-sha' },
    ];
    const contents = {
      'Solution.java': 'Java Code',
      'Solution.cpp': 'C++ Code',
    };
    const migration = await prepareGitHubDirectoryMigration(
      'who-will-win-1587115621',
      '0001-who-will-win',
      {
        createMessage: 'Add Who Will Win solution',
        updateMessage: 'Update Who Will Win solution',
        deleteMessage: 'Migrate Who Will Win to 0001-who-will-win',
      },
      {
        connection,
        getFile: async (_token, _repository, _directory, filename) =>
          filename
            ? { content: encodeContent(contents[filename]), sha: `${filename}-sha` }
            : entries,
        syncFile: async (content, directory, filename) => {
          copied.push({ content, directory, filename });
          return { action: 'created', sha: 'new-sha' };
        },
        deleteFile: async (...args) => deleted.push(args),
      }
    );

    expect(copied).toEqual([
      { content: 'Java Code', directory: '0001-who-will-win', filename: 'Solution.java' },
      { content: 'C++ Code', directory: '0001-who-will-win', filename: 'Solution.cpp' },
    ]);
    expect(deleted).toEqual([]);

    const cleanup = await migration.cleanup();
    expect(cleanup.status).toBe('migrated');
    expect(deleted.map(call => call[3])).toEqual(['README.md', 'Solution.java', 'Solution.cpp']);
  });
});
