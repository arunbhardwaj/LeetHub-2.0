import { LeetCodeV1, LeetCodeV2 } from './versions';
import setupManualSubmitBtn from './submitBtn';
import {
  debounce,
  DIFFICULTY,
  getBrowser,
  isEmpty,
  LeetHubError,
  RepoReadmeNotFoundErr,
} from './util';
import { appendProblemToReadme, sortTopicsInReadme } from './readmeTopics';

/* Commit messages */
const readmeMsg = 'Create README - LeetHub';
const updateReadmeMsg = 'Update README - Topic Tags';
const discussionMsg = 'Prepend discussion post - LeetHub';
const createNotesMsg = 'Attach NOTES - LeetHub';
const defaultRepoReadme =
  'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)';
const readmeFilename = 'README.md';

// problem types
const NORMAL_PROBLEM = 0;
const EXPLORE_SECTION_PROBLEM = 1;

const WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS = 500;

const api = getBrowser();

const getPath = (problem, filename) => {
  return filename ? `${problem}/${filename}` : problem;
};

/* Main function for uploading code to GitHub repo, and callback cb is called if success */
const upload = (token, hook, content, problem, filename, sha, message) => {
  const path = getPath(problem, filename);
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

  let data = {
    message,
    content,
    sha,
  };

  data = JSON.stringify(data);

  let options = {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: data,
  };
  let newSha;

  return fetch(URL, options)
    .then(res => {
      if (!res.ok) {
        throw new LeetHubError(res.status, res);
        // throw new LeetHubError('File already exists with GitHub. Updating instead.');
      }
      return res.json();
    })
    .then(async body => {
      newSha = body.content.sha;
      const stats = await getAndInitializeStats(problem);
      stats.shas[problem][filename] = newSha;
      return api.storage.local.set({ stats });
    })
    .then(() => console.log(`Successfully committed ${getPath(problem, filename)} to github`));
};

// Returns stats object. If it didn't exist, initializes stats with default difficulty values and initializes the sha object for problem
const getAndInitializeStats = problem => {
  return api.storage.local.get('stats').then(({ stats }) => {
    if (stats == null || isEmpty(stats)) {
      stats = {};
      stats.shas = {};
      stats.solved = 0;
      stats.easy = 0;
      stats.medium = 0;
      stats.hard = 0;
    }

    if (stats.shas[problem] == null) {
      stats.shas[problem] = {};
    }

    return stats;
  });
};

const incrementStats = (difficulty) => {
  return api.storage.local
    .get('stats')
    .then(({ stats }) => {
      stats.solved += 1;
      stats.easy += difficulty === DIFFICULTY.EASY ? 1 : 0;
      stats.medium += difficulty === DIFFICULTY.MEDIUM ? 1 : 0;
      stats.hard += difficulty === DIFFICULTY.HARD ? 1 : 0;
      api.storage.local.set({ stats });
      return stats;
    })
    .then(uploadPersistentStats);
  // .catch(console.error)
};

const checkAlreadyCompleted = problemName => {
  return api.storage.local.get('stats').then(({ stats }) => {
    if (stats?.shas?.[problemName] == null) {
      return false;
    }
    return true;
  });
};

/* Main function for updating code on GitHub Repo */
/* Read from existing file on GitHub */
/* Discussion posts prepended at top of README */
/* Future implementations may require appending to bottom of file */
const update = (
  token,
  hook,
  addition,
  directory,
  filename,
  commitMsg,
  shouldPreprendDiscussionPosts
) => {
  let responseSHA;

  return getGitHubFile(token, hook, directory, filename)
    .then(resp => resp.json())
    .then(data => {
      responseSHA = data.sha;
      return decodeURIComponent(escape(atob(data.content)));
    })
    .then(existingContent =>
      // https://web.archive.org/web/20190623091645/https://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
      // In order to preserve mutation of the data, we have to encode it, which is usually done in base64.
      // But btoa only accepts ASCII 7 bit chars (0-127) while Javascript uses 16-bit minimum chars (0-65535).
      // EncodeURIComponent converts the Unicode Points UTF-8 bits to hex UTF-8.
      // Unescape converts percent-encoded hex values into regular ASCII (optional; it shrinks string size).
      // btoa converts ASCII to base64.
      shouldPreprendDiscussionPosts
        ? btoa(unescape(encodeURIComponent(addition + existingContent)))
        : btoa(unescape(encodeURIComponent(existingContent)))
    )
    .then(newContent =>
      upload(token, hook, newContent, directory, filename, responseSHA, commitMsg)
    );
};

function uploadGit(
  code,
  problemName,
  fileName,
  commitMsg,
  action,
  shouldPrependDiscussionPosts = false
) {
  let token;
  let hook;

  return api.storage.local
    .get(['leethub_token', 'mode_type', 'leethub_hook', 'stats'])
    .then(({ leethub_token, leethub_hook, mode_type, stats }) => {
      token = leethub_token;
      if (leethub_token == undefined) {
        throw new LeetHubError('LeethubTokenUndefined');
      }

      if (mode_type !== 'commit') {
        throw new LeetHubError('LeetHubNotAuthorizedByGit');
      }

      hook = leethub_hook;
      if (!hook) {
        throw new LeetHubError('NoRepoDefined');
      }
      if (action === 'upload') {
        /* Get SHA, if it exists */
        const sha =
          stats?.shas?.[problemName]?.[fileName] !== undefined
            ? stats.shas[problemName][fileName]
            : '';

        return upload(token, hook, code, problemName, fileName, sha, commitMsg);
      } else if (action === 'update') {
        return update(
          token,
          hook,
          code,
          problemName,
          fileName,
          commitMsg,
          shouldPrependDiscussionPosts
        );
      }
    })
    .catch(err => {
      // if (err instanceof LeetHubError) {
      if (err.message === '409') {
        return getGitHubFile(token, hook, problemName, fileName).then(resp => resp.json());
      } else {
        throw err;
      }
    })
    .then(data =>
      data != null // if it isn't null, then we didn't upload successfully the first time, and must have retrieved new data and reuploaded
        ? upload(token, hook, code, problemName, fileName, data.sha, commitMsg)
        : undefined
    );
  // .catch(e => console.error(new LeetHubError(e.message)));
}

/* Returns GitHub data for the file specified by `${directory}/${filename}` path */
async function getGitHubFile(token, hook, directory, filename) {
  const path = getPath(directory, filename);
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  return fetch(URL, options).then(res => {
    if (!res.ok) {
      throw new Error(res.status);
    }
    return res;
  });
}

// Updates or creates the persistent stats from local stats
async function uploadPersistentStats(localStats) {
  const pStats = { leetcode: localStats };
  const pStatsEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(pStats))));
  return delay(
    uploadGit,
    WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS,
    pStatsEncoded,
    'stats.json',
    '',
    `Updated stats`,
    'upload'
  );
}

//TODO: move to utils
// Delays `func` invocation with `...args` until after `wait` milliseconds
function delay(func, wait, ...args) {
  return setTimeout(() => func(...args), wait);
}

/* Discussion Link - When a user makes a new post, the link is prepended to the README for that problem.*/
document.addEventListener('click', event => {
  const element = event.target;
  const oldPath = window.location.pathname;

  /* Act on Post button click */
  /* Complex since "New" button shares many of the same properties as "Post button */
  if (
    element.classList.contains('icon__3Su4') ||
    element.parentElement.classList.contains('icon__3Su4') ||
    element.parentElement.classList.contains('btn-content-container__214G') ||
    element.parentElement.classList.contains('header-right__2UzF')
  ) {
    setTimeout(function () {
      /* Only post if post button was clicked and url changed */
      if (
        oldPath !== window.location.pathname &&
        oldPath === window.location.pathname.substring(0, oldPath.length) &&
        !Number.isNaN(window.location.pathname.charAt(oldPath.length))
      ) {
        const date = new Date();
        const currentDate = `${date.getDate()}/${date.getMonth()}/${date.getFullYear()} at ${date.getHours()}:${date.getMinutes()}`;
        const addition = `[Discussion Post (created on ${currentDate})](${window.location})  \n`;
        const problemName = window.location.pathname.split('/')[2]; // must be true.

        uploadGit(addition, problemName, readmeFilename, discussionMsg, 'update', true);
      }
    }, 1000);
  }
});

function createRepoReadme() {
  const content = btoa(unescape(encodeURIComponent(defaultRepoReadme)));
  return uploadGit(content, readmeFilename, '', readmeMsg, 'upload');
}

async function updateReadmeTopicTagsWithProblem(topicTags, problemName) {
  if (topicTags == null) {
    console.log(new LeetHubError('TopicTagsNotFound'));
    return;
  }

  const { leethub_token, leethub_hook, stats } = await api.storage.local.get([
    'leethub_token',
    'leethub_hook',
    'stats',
  ]);
  let readme;
  try {
      const { content, sha } = await getGitHubFile(leethub_token, leethub_hook, readmeFilename).then(resp => resp.json());
      readme = content;
      stats.shas[readmeFilename] = {'': sha}
      await chrome.storage.local.set({stats})
  } catch (err) {
    if (err.message === '404') {
      throw new RepoReadmeNotFoundErr('RepoReadmeNotFound', topicTags, problemName);
    }

    throw err;
  }
  readme = decodeURIComponent(escape(atob(readme)));
  for (let topic of topicTags) {
    readme = appendProblemToReadme(topic.name, readme, leethub_hook, problemName);
  }
  readme = sortTopicsInReadme(readme);
  readme = btoa(unescape(encodeURIComponent(readme)));
  return new Promise((resolve, reject) =>
    setTimeout(
      () => resolve(uploadGit(readme, readmeFilename, '', updateReadmeMsg, 'upload')),
      WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
    )
  );
}

function loader(leetCode) {
  let iterations = 0;
  const intervalId = setInterval(async () => {
    try {
      const isSuccessfulSubmission = leetCode.getSuccessStateAndUpdate();
      if (!isSuccessfulSubmission) {
        iterations++;
        if (iterations > 9) {
          // poll for max 10 attempts (10 seconds)
          throw new LeetHubError('Could not find successful submission after 10 seconds.');
        }
        return;
      }
      leetCode.startSpinner();

      // If successful, stop polling
      clearInterval(intervalId);

      // For v2, query LeetCode API for submission results
      await leetCode.init();

      const probStats = leetCode.parseStats();
      if (!probStats) {
        throw new LeetHubError('SubmissionStatsNotFound');
      }

      const probStatement = leetCode.parseQuestion();
      if (!probStatement) {
        throw new LeetHubError('ProblemStatementNotFound');
      }

      const problemName = leetCode.getProblemNameSlug();
      const alreadyCompleted = await checkAlreadyCompleted(problemName);
      const language = leetCode.getLanguageExtension();
      if (!language) {
        throw new LeetHubError('LanguageNotFound');
      }
      const filename = problemName + language;

      /* Upload README */
      const uploadReadMe = await api.storage.local.get('stats').then(({ stats }) => {
        const shaExists = stats?.shas?.[problemName]?.[readmeFilename] !== undefined;

        if (!shaExists) {
          return uploadGit(
            btoa(unescape(encodeURIComponent(probStatement))),
            problemName,
            readmeFilename,
            readmeMsg,
            'upload',
            false
          );
        }
      });

      /* Upload Notes if any*/
      const notes = leetCode.getNotesIfAny();
      let uploadNotes;
      if (notes != undefined && notes.length > 0) {
        uploadNotes = uploadGit(
          btoa(unescape(encodeURIComponent(notes))),
          problemName,
          'NOTES.md',
          createNotesMsg,
          'upload',
          false
        );
      }

      /* Upload code to Git */
      const code = leetCode.findCode(probStats);
      const uploadCode = uploadGit(
        btoa(unescape(encodeURIComponent(code))),
        problemName,
        filename,
        probStats,
        'upload',
        false
      );

      /* Group problem into its relevant topics */
      const updateRepoReadMe = updateReadmeTopicTagsWithProblem(
        leetCode.submissionData?.question?.topicTags,
        problemName
      );

      await Promise.all([uploadReadMe, uploadNotes, uploadCode, updateRepoReadMe]);

      leetCode.markUploaded();

      if (!alreadyCompleted) {
        incrementStats(leetCode.difficulty); // Increments local and persistent stats
      }
    } catch (err) {
      leetCode.markUploadFailed();
      clearInterval(intervalId);

      if (!(err instanceof LeetHubError)) {
        console.error(err);
        return;
      }

      if (err instanceof RepoReadmeNotFoundErr) {
        await createRepoReadme();
        await new Promise(resolve => {
          setTimeout(
            () => resolve(updateReadmeTopicTagsWithProblem(err.topicTags, err.problemName)),
            WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS
          );
        });
      }
    }
  }, 1000);
}

// Submit by Keyboard Shortcuts only support on LeetCode v2
function wasSubmittedByKeyboard(event) {
  const isEnterKey = event.key === 'Enter';
  const isMacOS = window.navigator.userAgent.includes('Mac');

  // Adapt to MacOS operating system
  return isEnterKey && ((isMacOS && event.metaKey) || (!isMacOS && event.ctrlKey));
}

// Get SubmissionID by listening for URL changes to `/submissions/(d+)` format
async function listenForSubmissionId() {
  const { submissionId } = await api.runtime.sendMessage({
    type: 'LEETCODE_SUBMISSION',
  });
  if (submissionId == null) {
    console.log(new LeetHubError('SubmissionIdNotFound'));
    return;
  }
  return submissionId;
}

async function v2SubmissionHandler(event, leetCode) {
  if (event.type !== 'click' && !wasSubmittedByKeyboard(event)) {
    return;
  }

  const authenticated =
    !isEmpty(await api.storage.local.get(['leethub_token'])) &&
    !isEmpty(await api.storage.local.get(['leethub_hook']));
  if (!authenticated) {
    throw new LeetHubError('UserNotAuthenticated');
  }

  // is click or is ctrl enter
  const submissionId = await listenForSubmissionId();
  leetCode.submissionId = submissionId;
  loader(leetCode);
  return true;
}

// Use MutationObserver to determine when the submit button elements are loaded
const submitBtnObserver = new MutationObserver(function (_mutations, observer) {
  const v1SubmitBtn = document.querySelector('[data-cy="submit-code-btn"]');
  const v2SubmitBtn = document.querySelector('[data-e2e-locator="console-submit-button"]');
  const textareaList = document.getElementsByTagName('textarea');
  const textarea =
    textareaList.length === 4
      ? textareaList[2]
      : textareaList.length === 2
      ? textareaList[0]
      : textareaList[1];

  if (v1SubmitBtn) {
    observer.disconnect();

    const leetCode = new LeetCodeV1();
    v1SubmitBtn.addEventListener('click', () => loader(leetCode));
    return;
  }

  if (v2SubmitBtn && textarea) {
    observer.disconnect();

    const leetCode = new LeetCodeV2();
    if (!!!v2SubmitBtn.onclick) {
      textarea.addEventListener('keydown', e => v2SubmissionHandler(e, leetCode));
      v2SubmitBtn.onclick = e => v2SubmissionHandler(e, leetCode);
    }
  }
});

submitBtnObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

/* Sync to local storage */
api.storage.local.get('isSync', data => {
  const keys = [
    'leethub_token',
    'leethub_username',
    'pipe_leethub',
    'stats',
    'leethub_hook',
    'mode_type',
  ];
  if (!data || !data.isSync) {
    keys.forEach(key => {
      api.storage.sync.get(key, data => {
        api.storage.local.set({ [key]: data[key] });
      });
    });
    api.storage.local.set({ isSync: true }, () => {
      console.log('LeetHub Synced to local values');
    });
  } else {
    console.log('LeetHub Local storage already synced!');
  }
});

setupManualSubmitBtn(
  debounce(
    () => {
      // Manual submission event doesn't need to wait for submission url. It already has it.
      const leetCode = new LeetCodeV2();
      const submissionId = window.location.href.match(/leetcode\.com\/.*\/submissions\/(\d+)/)[1];
      leetCode.submissionId = submissionId;
      loader(leetCode);
      return;
    },
    5000,
    true
  )
);

class LeetHubNetworkError extends LeetHubError {
  constructor(response) {
    super(response.statusText);
    this.status = response.status;
  }
}
