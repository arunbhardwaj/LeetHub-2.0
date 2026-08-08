import { GitHubError, prepareGitHubDirectoryMigration, syncGitHubFile } from '../core/github.js';
import { LANGUAGE_DEFINITIONS } from '../core/languages.js';
import {
  finalizeGfgRepositoryProblem,
  recordSuccessfulSync,
  reserveGfgRepositoryProblem,
} from '../core/storage.js';
import { getCanonicalProblemUrl, sanitizeSlug } from './metadata.js';
import { generateRootReadme, languageFromExtension } from './repository.js';
import { Verdict } from './verdict.js';

const SUPPORTED_EXTENSIONS = new Set(LANGUAGE_DEFINITIONS.map(definition => definition.extension));

function displayDifficulty(value) {
  if (!value) return null;
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

export function generateProblemReadme(problem) {
  const sections = [`# ${problem.title}`];
  const difficulty = displayDifficulty(problem.difficulty);
  if (difficulty) sections.push(`**Difficulty:** ${difficulty}`);
  if (problem.url) {
    sections.push(`**GeeksforGeeks:** [View Problem](${problem.url})`);
  }
  const topics = [...new Set(problem.tags ?? [])]
    .filter(topic => typeof topic === 'string')
    .map(topic => String(topic).trim())
    .filter(Boolean);
  if (topics.length > 0) {
    sections.push(`**Topics:** ${topics.join(', ')}`);
  }
  if (problem.statement) {
    sections.push(`## Problem Statement\n\n${problem.statement}`);
  }
  return `${sections.join('\n\n')}\n`;
}

function validateSubmission(submission) {
  const problem = submission?.problem;
  const solution = submission?.solution;
  const slug = sanitizeSlug(problem?.slug ?? submission?.slug);
  const extension = solution?.extension ?? submission?.extension;
  const code = solution?.code ?? submission?.code;
  const title = String(problem?.title ?? submission?.title ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  const url = getCanonicalProblemUrl(problem?.url ?? submission?.url);

  if (!submission?.attemptId) return { error: 'attempt_id_missing' };
  if (!slug) return { error: 'problem_slug_missing' };
  if (!title) return { error: 'problem_title_missing' };
  if (!url) return { error: 'problem_url_missing' };
  if (!SUPPORTED_EXTENSIONS.has(extension)) return { error: 'unsupported_extension' };
  if (typeof code !== 'string' || code.length === 0) {
    return { error: 'source_code_missing' };
  }

  return {
    problem: {
      ...(problem ?? {}),
      title,
      slug,
      url,
    },
    code,
    extension,
  };
}

export function normalizeSyncError(error) {
  const status = error instanceof GitHubError ? error.status : null;
  if (status === 429) return 'rate_limited';
  if (status === 403) {
    const remaining = error.response?.headers?.get?.('x-ratelimit-remaining');
    const retryAfter = error.response?.headers?.get?.('retry-after');
    return remaining === '0' || retryAfter ? 'rate_limited' : 'permission_denied';
  }
  const statusReasons = {
    401: 'authentication_failed',
    404: 'repository_not_found',
    409: 'conflict',
    422: 'validation_failed',
    LeethubTokenUndefined: 'github_not_authenticated',
    GitHubNotAuthorized: 'github_not_connected',
    NoRepoDefined: 'repository_not_selected',
  };

  if (statusReasons[status]) return statusReasons[status];
  if (error instanceof TypeError) return 'network_failure';
  return 'github_sync_failed';
}

export function createAcceptedSubmissionSync({
  syncFile = syncGitHubFile,
  recordSync = recordSuccessfulSync,
  reserveProblem = reserveGfgRepositoryProblem,
  finalizeProblem = finalizeGfgRepositoryProblem,
  prepareMigration = null,
} = {}) {
  const attempts = new Map();
  const migrate =
    prepareMigration ??
    ((source, target, messages) =>
      prepareGitHubDirectoryMigration(source, target, messages, { syncFile }));

  return function syncAcceptedSubmission(submission) {
    if (submission?.verdict !== Verdict.ACCEPTED) {
      return Promise.resolve(
        Object.freeze({
          status: 'skipped',
          reason: 'verdict_not_accepted',
          attemptId: submission?.attemptId ?? null,
          files: Object.freeze([]),
        })
      );
    }

    const attemptId = submission?.attemptId;
    if (attemptId && attempts.has(attemptId)) return attempts.get(attemptId);

    const operation = (async () => {
      const validated = validateSubmission(submission);
      if (validated.error) {
        return Object.freeze({
          status: 'failed',
          reason: validated.error,
          attemptId: attemptId ?? null,
          files: Object.freeze([]),
        });
      }

      const { problem, code, extension } = validated;
      const solutionFilename = `Solution${extension}`;
      const messages = {
        createMessage: `Add ${problem.title} solution`,
        updateMessage: `Update ${problem.title} solution`,
      };
      const rootMessages = {
        createMessage: 'Update GFG README',
        updateMessage: 'Update GFG README',
      };
      const files = [];

      try {
        const reserved = await reserveProblem(problem);
        const directory = reserved.entry.directory;
        const migration = await migrate(problem.slug, directory, {
          ...messages,
          deleteMessage: `Migrate ${problem.title} to ${directory}`,
        });

        const solution = await syncFile(code, directory, solutionFilename, messages);
        files.push({ path: `${directory}/${solutionFilename}`, action: solution.action });

        const language = submission.solution?.language ?? submission.language ?? null;
        const normalizedLanguage = language?.normalized ?? language;
        const migratedLanguages = (migration.copied ?? [])
          .filter(filename => filename.startsWith('Solution.'))
          .map(filename => languageFromExtension(`.${filename.split('.').slice(1).join('.')}`))
          .filter(Boolean);

        const readme = await syncFile(
          generateProblemReadme(problem),
          directory,
          'README.md',
          messages
        );
        files.push({ path: `${directory}/README.md`, action: readme.action });

        const finalized = await finalizeProblem(problem, [
          ...migratedLanguages,
          normalizedLanguage,
        ]);
        const rootReadme = await syncFile(
          generateRootReadme(finalized.index),
          '',
          'README.md',
          rootMessages
        );
        files.push({ path: 'README.md', action: rootReadme.action });

        let migrationStatus = 'not_needed';
        try {
          migrationStatus = (await migration.cleanup()).status;
        } catch (_error) {
          migrationStatus = 'cleanup_failed';
        }

        await recordSync({
          title: problem.title,
          slug: problem.slug,
          difficulty: problem.difficulty ?? null,
          language: normalizedLanguage,
          syncedAt: Date.now(),
        });

        return Object.freeze({
          status:
            files.every(file => file.action === 'unchanged') &&
            ['not_needed', 'not_found'].includes(migrationStatus)
              ? 'unchanged'
              : 'synced',
          attemptId,
          directory,
          migration: migrationStatus,
          files: Object.freeze(files.map(file => Object.freeze(file))),
        });
      } catch (error) {
        return Object.freeze({
          status: 'failed',
          reason: normalizeSyncError(error),
          attemptId,
          files: Object.freeze(files.map(file => Object.freeze(file))),
        });
      }
    })();

    if (attemptId) attempts.set(attemptId, operation);
    return operation;
  };
}

export const syncAcceptedSubmission = createAcceptedSubmissionSync();
