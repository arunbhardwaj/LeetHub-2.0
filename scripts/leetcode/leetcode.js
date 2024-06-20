import { LeetCodeV1, LeetCodeV2 } from './versions';
import setupManualSubmitBtn from './submitBtn';
import { debounce, DIFFICULTY, getBrowser, isEmpty, LeetHubError, RepoReadmeNotFoundErr } from './util';
import { appendProblemToReadme, sortTopicsInReadme } from './readmeTopics';

/* Commit messages */
const readmeMsg = 'Create README - LeetHub';
const updateReadmeMsg = 'Update README - Topic Tags';
const discussionMsg = 'Prepend discussion post - LeetHub';
const createNotesMsg = 'Attach NOTES - LeetHub';
const defaultRepoReadme =
  'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)';

// problem types
const NORMAL_PROBLEM = 0;
const EXPLORE_SECTION_PROBLEM = 1;

const WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS = 500;

const api = getBrowser();

const getPath = (problem, filename) => {
  return filename ? `${problem}/${filename}` : problem;
};

/* Main function for uploading code to GitHub repo, and callback cb is called if success */
const upload = (token, hook, code, problem, filename, sha, commitMsg, cb = undefined) => {
  const path = getPath(problem, filename);
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

  /* Define Payload */
  let data = {
    message: commitMsg,
    content: code,
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
  let updatedSha;

  return fetch(URL, options)
    .then(res => {
      if (!res.ok) {
        throw new LeetHubError(res.status, res);
      }
      return res.json();
    })
    .then(async body => {
      updatedSha = body.content.sha; // get updated SHA.
      const stats = await getAndInitializeStats(problem);
      stats.shas[problem][filename] = updatedSha;
      return api.storage.local.set({ stats });
    })
    .then(() => {
      console.log(`Successfully committed ${getPath(problem, filename)} to github`);
      if (cb) {
        cb();
      }
    });
};

const getAndInitializeStats = problem => {
  return api.storage.local.get('stats').then(({ stats }) => {
    if (stats == null || isEmpty(stats)) {
      // create stats object
      stats = {};
      stats.solved = 0;
      stats.easy = 0;
      stats.medium = 0;
      stats.hard = 0;
      stats.shas = {};
    }

    if (stats.shas[problem] == null) {
      stats.shas[problem] = {};
    }

    return stats;
  });
};

const incrementStats = difficulty => {
  return api.storage.local.get('stats').then(({ stats }) => {
    stats.solved += 1;
    stats.easy += difficulty === DIFFICULTY.EASY ? 1 : 0;
    stats.medium += difficulty === DIFFICULTY.MEDIUM ? 1 : 0;
    stats.hard += difficulty === DIFFICULTY.HARD ? 1 : 0;
    return api.storage.local.set({ stats });
  });
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
  shouldPreprendDiscussionPosts,
  cb = undefined,
) => {
  let responseSHA;
  return getUpdatedData(token, hook, directory, filename)
    .then(data => {
      responseSHA = data.sha;
      return decodeURIComponent(escape(atob(data.content)));
    })
    .then(existingContent =>
      shouldPreprendDiscussionPosts
        ? // https://web.archive.org/web/20190623091645/https://monsur.hossa.in/2012/07/20/utf-8-in-javascript.html
          // In order to preserve mutation of the data, we have to encode it, which is usually done in base64.
          // But btoa only accepts ASCII 7 bit chars (0-127) while Javascript uses 16-bit minimum chars (0-65535).
          // EncodeURIComponent converts the Unicode Points UTF-8 bits to hex UTF-8.
          // Unescape converts percent-encoded hex values into regular ASCII (optional; it shrinks string size).
          // btoa converts ASCII to base64.
          btoa(unescape(encodeURIComponent(addition + existingContent)))
        : btoa(unescape(encodeURIComponent(existingContent))),
    )
    .then(newContent =>
      upload(token, hook, newContent, directory, filename, responseSHA, commitMsg, cb),
    );
};

function uploadGit(
  code,
  problemName,
  fileName,
  commitMsg,
  action,
  shouldPrependDiscussionPosts = false,
  cb = undefined,
) {
  let token;
  let hook;

  return api.storage.local
    .get('leethub_token')
    .then(({ leethub_token }) => {
      token = leethub_token;
      if (leethub_token == undefined) {
        throw new LeetHubError('LeethubTokenUndefined');
      }
      return api.storage.local.get('mode_type');
    })
    .then(({ mode_type }) => {
      if (mode_type !== 'commit') {
        throw new LeetHubError('LeetHubNotAuthorizedByGit');
      }
      return api.storage.local.get('leethub_hook');
    })
    .then(({ leethub_hook }) => {
      hook = leethub_hook;
      if (!hook) {
        throw new LeetHubError('NoRepoDefined');
      }
      return api.storage.local.get('stats');
    })
    .then(({ stats }) => {
      if (action === 'upload') {
        /* Get SHA, if it exists */
        const sha =
          stats?.shas?.[problemName]?.[fileName] !== undefined
            ? stats.shas[problemName][fileName]
            : '';

        return upload(token, hook, code, problemName, fileName, sha, commitMsg, cb);
      } else if (action === 'update') {
        return update(
          token,
          hook,
          code,
          problemName,
          fileName,
          commitMsg,
          shouldPrependDiscussionPosts,
          cb,
        );
      }
    })
    .catch(err => {
      if (err.message === '409') {
        return getUpdatedData(token, hook, problemName, fileName);
      } else {
        throw err;
      }
    })
    .then(data =>
      data != null // if it isn't null, then we didn't uplaod successfully the first time, and must have retrieved new data and reuploaded
        ? upload(token, hook, code, problemName, fileName, data.sha, commitMsg, cb)
        : undefined,
    );
}

/* Gets updated GitHub data for the specific file in repo in question */
async function getUpdatedData(token, hook, directory, filename) {
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
    return res.json();
  });
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

        uploadGit(addition, problemName, 'README.md', discussionMsg, 'update', true);
      }
    }, 1000);
  }
});

function createRepoReadme() {
  const content = btoa(unescape(encodeURIComponent(defaultRepoReadme)));
  return uploadGit(content, 'README.md', '', readmeMsg, 'upload');
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
    const { content } = await getUpdatedData(leethub_token, leethub_hook, 'README.md');
    readme = content;
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
      () => resolve(uploadGit(readme, 'README.md', '', updateReadmeMsg, 'upload')),
      WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS,
    ),
  );
}

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

const loader = leetCode => {
  let iterations = 0;
  const intervalId = setInterval(async () => {
    try {
      leetCode.startSpinner();
      const isSuccessfulSubmission = leetCode.getSuccessStateAndUpdate();
      if (!isSuccessfulSubmission) {
        iterations++;
        if (iterations > 9) {
          clearInterval(intervalId); // poll for max 10 attempts (10 seconds)
        }
        return;
      }

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
      const updateReadMe = await api.storage.local.get('stats').then(({ stats }) => {
        const shaExists = stats?.shas?.[problemName]?.['README.md'] !== undefined;

        if (!shaExists) {
          return uploadGit(
            btoa(unescape(encodeURIComponent(probStatement))),
            problemName,
            'README.md',
            readmeMsg,
            'upload',
            false,
          );
        }
      });

      /* Upload Notes if any*/
      const notes = leetCode.getNotesIfAny();
      let updateNotes;
      if (notes != undefined && notes.length > 0) {
        updateNotes = uploadGit(
          btoa(unescape(encodeURIComponent(notes))),
          problemName,
          'NOTES.md',
          createNotesMsg,
          'upload',
          false,
        );
      }

      /* Upload code to Git */
      const code = leetCode.findCode(probStats);
      const updateCode = uploadGit(
        btoa(unescape(encodeURIComponent(code))),
        problemName,
        filename,
        probStats,
        'upload',
        false,
      );

      /* Group problem into its relevant topics */
      let updateRepoReadme = updateReadmeTopicTagsWithProblem(
        leetCode.submissionData?.question?.topicTags,
        problemName,
      );

      await Promise.all([updateReadMe, updateNotes, updateCode, updateRepoReadme]);

      leetCode.markUploaded();

      if (!alreadyCompleted) {
        incrementStats(leetCode.difficulty);
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
            WAIT_FOR_GITHUB_API_TO_NOT_THROW_409_MS,
          );
        });
      }
    }
  }, 1000);
};

const isMacOS = window.navigator.userAgent.includes('Mac');

// Get SubmissionID by listening for URL changes to `/submissions/(d+)` format
async function listenForSubmissionId() {
  const { submissionId } = await api.runtime.sendMessage({ type: 'LEETCODE_SUBMISSION' });
  if (submissionId == null) {
    console.log(new LeetHubError('SubmissionIdNotFound'));
    return;
  }
  return submissionId;
}

// Submit by Keyboard Shortcuts only support on LeetCode v2
function wasSubmittedByKeyboard(event) {
  const isEnterKey = event.key === 'Enter';

  // Adapt to MacOS operating system
  return isEnterKey && ((isMacOS && event.metaKey) || (!isMacOS && event.ctrlKey));
}

// Use MutationObserver to determine when the submit button elements are loaded
const observer = new MutationObserver(function (_mutations, observer) {
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
      textarea.addEventListener('keydown', e => v2SubmissionHandler(leetCode, e));
      v2SubmitBtn.onclick = e => v2SubmissionHandler(leetCode, e);
    }
  }
});

async function v2SubmissionHandler(leetCode, event) {
  if (event.type !== 'click' && !wasSubmittedByKeyboard(event)) {
    return;
  }

  // is click or is ctrl enter
  const submissionId = await listenForSubmissionId();
  leetCode.submissionId = submissionId;
  loader(leetCode);
  return true;
}

observer.observe(document.body, {
  childList: true,
  subtree: true,
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
    true,
  ),
);
