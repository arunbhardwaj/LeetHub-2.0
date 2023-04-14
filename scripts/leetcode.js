/* Enum for languages supported by LeetCode. */
const languages = {
  Python: '.py',
  Python3: '.py',
  'C++': '.cpp',
  C: '.c',
  Java: '.java',
  'C#': '.cs',
  JavaScript: '.js',
  Javascript: '.js',
  Ruby: '.rb',
  Swift: '.swift',
  Go: '.go',
  Kotlin: '.kt',
  Scala: '.scala',
  Rust: '.rs',
  PHP: '.php',
  TypeScript: '.ts',
  MySQL: '.sql',
  'MS SQL Server': '.sql',
  Oracle: '.sql',
};

/* Commit messages */
const readmeMsg = 'Create README - LeetHub';
const discussionMsg = 'Prepend discussion post - LeetHub';
const createNotesMsg = 'Attach NOTES - LeetHub';

// problem types
const NORMAL_PROBLEM = 0;
const EXPLORE_SECTION_PROBLEM = 1;

/* Difficulty of most recenty submitted question */
let difficulty = '';

/* state of upload for progress */
let uploadState = { uploading: false };

/* Main function for uploading code to GitHub repo, and callback cb is called if success */
const upload = (token, hook, code, problem, filename, sha, commitMsg, cb = undefined) => {
  const URL = `https://api.github.com/repos/${hook}/contents/${problem}/${filename}`;

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
      if (res.status === 200 || res.status === 201) {
        return res.json();
      } else if (res.status === 409) {
        throw new Error('409');
      }
    })
    .then(body => {
      updatedSha = body.content.sha; // get updated SHA.
      return chrome.storage.local.get('stats');
    })
    .then(({ stats }) => {
      if (stats == null || stats === {}) {
        // create stats object
        stats = {};
        stats.solved = 0;
        stats.easy = 0;
        stats.medium = 0;
        stats.hard = 0;
        stats.shas = {};
      }
      const filePath = problem + filename;

      // Only increment stats once. New submission commits twice (README and problem)
      const isFirstCompletion = stats?.shas?.[problem] === undefined && filename === 'README.md';
      if (isFirstCompletion) {
        stats.solved += 1;
        stats.easy += difficulty === 'Easy' ? 1 : 0;
        stats.medium += difficulty === 'Medium' ? 1 : 0;
        stats.hard += difficulty === 'Hard' ? 1 : 0;
        stats.shas[problem] = {};
      }
      stats.shas[problem][filename] = updatedSha;
      console.log('Upload:SHAUpdatedAfterUpload', updatedSha);
      return chrome.storage.local.set({ stats });
    })
    .then(() => {
      console.log(`Successfully committed ${filename} to github`);
      if (cb != undefined) {
        cb();
      }
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
  console.log(`Update::${filename}::Data`, {
    token,
    hook,
    addition,
    directory,
    filename,
    commitMsg,
    shouldPreprendDiscussionPosts,
    cb,
  });
  const URL = `https://api.github.com/repos/${hook}/contents/${directory}/${filename}`;

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

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
  _diff = undefined,
) {
  // Assign difficulty
  if (_diff && _diff !== undefined) {
    difficulty = _diff.trim();
  }

  let token;
  let hook;

  console.log(`UploadGit::Action::${action}::File::${fileName}`);
  console.log(`UploadGit::Action::${action}::Data`, {
    code,
    problemName,
    fileName,
    commitMsg,
    action,
    shouldPrependDiscussionPosts,
    _diff,
  });

  return chrome.storage.local
    .get('leethub_token')
    .then(({ leethub_token }) => {
      token = leethub_token;
      if (leethub_token == undefined) {
        throw new Error('leethub token is undefined');
      }
      return chrome.storage.local.get('mode_type');
    })
    .then(({ mode_type }) => {
      if (mode_type !== 'commit') {
        throw new Error('leethub mode is not commit');
      }
      return chrome.storage.local.get('leethub_hook');
    })
    .then(({ leethub_hook }) => {
      hook = leethub_hook;
      if (!hook) {
        throw new Error('leethub hook not defined');
      }
      return chrome.storage.local.get('stats');
    })
    .then(({ stats }) => {
      if (action === 'upload') {
        const filePath = problemName + fileName;

        /* Get SHA, if it exists */
        const sha =
          stats?.shas?.[problemName]?.[fileName] !== undefined
            ? stats.shas[problemName][fileName]
            : '';

        console.log(`UploadGit::Action::${action}::File::${fileName}::Storage::SHA`, sha);
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
        console.log(
          `UploadGit::Action::${action}::File::${fileName}::Failure::SHAOutdated::Updating SHA...`,
        );
        return getUpdatedData(token, hook, problemName, fileName);
      } else {
        throw err;
      }
    })
    .then(data =>
      data ? upload(token, hook, code, problemName, fileName, data.sha, commitMsg, cb) : undefined,
    )
    .then(() => {
      console.log(`UploadGit::Action::${action}::File::${fileName}::Update::Success`);
    })
    .catch(console.error);
}

/* Gets updated GitHub data for the specific file in repo in question */
async function getUpdatedData(token, hook, directory, filename) {
  const URL = `https://api.github.com/repos/${hook}/contents/${directory}/${filename}`;

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  return fetch(URL, options).then(async res => {
    if (res.status === 200 || res.status === 201) {
      const body = await res.json();
      return body;
    } else {
      throw new Error('' + res.status);
    }
  });
}

/* Checks if an element exists */
function checkElem(elem) {
  return elem && elem.length > 0;
}

function convertToSlug(string) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;';
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------';
  const p = new RegExp(a.split('').join('|'), 'g');

  return string
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

function addLeadingZeros(title) {
  const maxTitlePrefixLength = 4;
  var len = title.split('-')[0].length;
  if (len < maxTitlePrefixLength) {
    return '0'.repeat(4 - len) + title;
  }
  return title;
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

function LeetCodeV1() {
  this.progressSpinnerElementId = 'leethub_progress_elem';
  this.progressSpinnerElementClass = 'leethub_progress';
  this.injectSpinnerStyle();
}
/* Function for finding and parsing the full code. */
/* - At first find the submission details url. */
/* - Then send a request for the details page. */
/* - Parse the code from the html reponse. */
/* - Parse the stats from the html response (explore section) */
LeetCodeV1.prototype.findAndUploadCode = function (
  problemName,
  fileName,
  commitMsg,
  action,
  cb = undefined,
) {
  /* Get the submission details url from the submission page. */
  let submissionURL;
  const e = document.getElementsByClassName('status-column__3SUg');
  if (checkElem(e)) {
    // for normal problem submisson
    const submissionRef = e[1].innerHTML.split(' ')[1];
    submissionURL = 'https://leetcode.com' + submissionRef.split('=')[1].slice(1, -1);
  } else {
    // for a submission in explore section
    const submissionRef = document.getElementById('result-state');
    submissionURL = submissionRef.href;
  }

  if (submissionURL == undefined) {
    return;
  }
  /* Request for the submission details page */
  return fetch(submissionURL)
    .then(res => {
      if (res.status == 200) {
        return res.text();
      } else {
        throw new Error('' + res.status);
      }
    })
    .then(responseText => {
      const doc = new DOMParser().parseFromString(responseText, 'text/html');
      /* the response has a js object called pageData. */
      /* Pagedata has the details data with code about that submission */
      const scripts = doc.getElementsByTagName('script');
      for (let i = 0; i < scripts.length; i++) {
        const text = scripts[i].innerText;
        if (text.includes('pageData')) {
          /* Extract the full code */
          const firstIndex = text.indexOf('submissionCode');
          const lastIndex = text.indexOf('editCodeUrl');
          let slicedText = text.slice(firstIndex, lastIndex);
          /* slicedText has form "submissionCode: 'Details code'" */
          /* Find the index of first and last single inverted coma. */
          const firstInverted = slicedText.indexOf("'");
          const lastInverted = slicedText.lastIndexOf("'");
          /* Extract only the code */
          const codeUnicoded = slicedText.slice(firstInverted + 1, lastInverted);
          /* The code has some unicode. Replacing all unicode with actual characters */
          const code = codeUnicoded.replace(/\\u[\dA-F]{4}/gi, function (match) {
            return String.fromCharCode(parseInt(match.replace(/\\u/g, ''), 16));
          });

          /* For a submission in explore section we do not get probStat beforehand.
            So, parse statistics from submisson page */
          if (!commitMsg) {
            slicedText = text.slice(text.indexOf('runtime'), text.indexOf('memory'));
            const resultRuntime = slicedText.slice(
              slicedText.indexOf("'") + 1,
              slicedText.lastIndexOf("'"),
            );
            slicedText = text.slice(text.indexOf('memory'), text.indexOf('total_correct'));
            const resultMemory = slicedText.slice(
              slicedText.indexOf("'") + 1,
              slicedText.lastIndexOf("'"),
            );
            commitMsg = `Time: ${resultRuntime}, Memory: ${resultMemory} - LeetHub`;
          }

          if (code != null) {
            return uploadGit(
              btoa(unescape(encodeURIComponent(code))),
              problemName,
              fileName,
              commitMsg,
              action,
              false,
              cb,
            );
          }
        }
      }
    });
};
LeetCodeV1.prototype.findLanguage = function () {
  const tag = [
    ...document.getElementsByClassName('ant-select-selection-selected-value'),
    ...document.getElementsByClassName('Select-value-label'),
  ];
  if (tag && tag.length > 0) {
    for (let i = 0; i < tag.length; i += 1) {
      const elem = tag[i].textContent;
      if (elem !== undefined && languages[elem] !== undefined) {
        return languages[elem];
      }
    }
  }
  return null;
};
/* function to get the notes if there is any
 the note should be opened atleast once for this to work
 this is because the dom is populated after data is fetched by opening the note */
LeetCodeV1.prototype.getNotesIfAny = function () {
  // there are no notes on expore
  if (document.URL.startsWith('https://leetcode.com/explore/')) return '';

  notes = '';
  if (
    checkElem(document.getElementsByClassName('notewrap__eHkN')) &&
    checkElem(
      document
        .getElementsByClassName('notewrap__eHkN')[0]
        .getElementsByClassName('CodeMirror-code'),
    )
  ) {
    notesdiv = document
      .getElementsByClassName('notewrap__eHkN')[0]
      .getElementsByClassName('CodeMirror-code')[0];
    if (notesdiv) {
      for (i = 0; i < notesdiv.childNodes.length; i++) {
        if (notesdiv.childNodes[i].childNodes.length == 0) continue;
        text = notesdiv.childNodes[i].childNodes[0].innerText;
        if (text) {
          notes = `${notes}\n${text.trim()}`.trim();
        }
      }
    }
  }
  return notes.trim();
};
/* Parser function for time/space stats */
LeetCodeV1.prototype.parseStats = function () {
  const probStats = document.getElementsByClassName('data__HC-i');
  if (!checkElem(probStats)) {
    return null;
  }
  const time = probStats[0].textContent;
  const timePercentile = probStats[1].textContent;
  const space = probStats[2].textContent;
  const spacePercentile = probStats[3].textContent;

  return `Time: ${time} (${timePercentile}), Space: ${space} (${spacePercentile}) - LeetHub`;
};
/* Parser function for the question, question title, question difficulty, and tags */
LeetCodeV1.prototype.parseQuestion = function () {
  var questionUrl = window.location.href;
  if (questionUrl.endsWith('/submissions/')) {
    questionUrl = questionUrl.substring(0, questionUrl.lastIndexOf('/submissions/') + 1);
  }
  const questionElem = document.getElementsByClassName('content__u3I1 question-content__JfgR');
  const questionDescriptionElem = document.getElementsByClassName('question-description__3U1T');
  if (checkElem(questionElem)) {
    const qbody = questionElem[0].innerHTML;

    // Problem title.
    let qtitle = document.getElementsByClassName('css-v3d350');
    if (checkElem(qtitle)) {
      qtitle = qtitle[0].innerHTML;
    } else {
      qtitle = 'unknown-problem';
    }

    // Problem difficulty, each problem difficulty has its own class.
    const isHard = document.getElementsByClassName('css-t42afm');
    const isMedium = document.getElementsByClassName('css-dcmtd5');
    const isEasy = document.getElementsByClassName('css-14oi08n');

    if (checkElem(isEasy)) {
      difficulty = 'Easy';
    } else if (checkElem(isMedium)) {
      difficulty = 'Medium';
    } else if (checkElem(isHard)) {
      difficulty = 'Hard';
    }
    // Final formatting of the contents of the README for each problem
    const markdown = `<h2><a href="${questionUrl}">${qtitle}</a></h2><h3>${difficulty}</h3><hr>${qbody}`;
    return markdown;
  } else if (checkElem(questionDescriptionElem)) {
    let questionTitle = document.getElementsByClassName('question-title');
    if (checkElem(questionTitle)) {
      questionTitle = questionTitle[0].innerText;
    } else {
      questionTitle = 'unknown-problem';
    }

    const questionBody = questionDescriptionElem[0].innerHTML;
    const markdown = `<h2>${questionTitle}</h2><hr>${questionBody}`;

    return markdown;
  }
};
LeetCodeV1.prototype.getProblemNameSlug = function () {
  const questionElem = document.getElementsByClassName('content__u3I1 question-content__JfgR');
  const questionDescriptionElem = document.getElementsByClassName('question-description__3U1T');
  let questionTitle = 'unknown-problem';
  if (checkElem(questionElem)) {
    let qtitle = document.getElementsByClassName('css-v3d350');
    if (checkElem(qtitle)) {
      questionTitle = qtitle[0].innerHTML;
    }
  } else if (checkElem(questionDescriptionElem)) {
    let qtitle = document.getElementsByClassName('question-title');
    if (checkElem(qtitle)) {
      questionTitle = qtitle[0].innerText;
    }
  }
  return addLeadingZeros(convertToSlug(questionTitle));
};
/* Gets the success state of the solution and updates html elements with new classes */
LeetCodeV1.prototype.getSuccessStateAndUpdate = function () {
  const successTag = document.getElementsByClassName('success__3Ai7');
  const resultState = document.getElementById('result-state');

  // check success state for a normal problem
  if (
    checkElem(successTag) &&
    successTag[0].className === 'success__3Ai7' &&
    successTag[0].innerText.trim() === 'Success'
  ) {
    console.log(successTag[0]);
    successTag[0].classList.add('marked_as_success');
    return true;
  }
  // check success state for a explore section problem
  else if (
    resultState &&
    resultState.className === 'text-success' &&
    resultState.innerText === 'Accepted'
  ) {
    resultState.classList.add('marked_as_success');
    return true;
  }

  return false;
};
/* Injects a spinner on left side to the "Run Code" button */
LeetCodeV1.prototype.startUploadSpinner = function () {
  try {
    elem = document.getElementById('leethub_progress_anchor_element');
    if (!elem) {
      elem = document.createElement('span');
      elem.id = 'leethub_progress_anchor_element';
      elem.style = 'margin-right: 20px;padding-top: 2px;';
    }
    elem.innerHTML = `<div id="${this.progressSpinnerElementId}" class="${this.progressSpinnerElementClass}"></div>`;
    target = this.insertToAnchorElement(elem);
    uploadState.uploading = true;
  } catch (error) {
    console.log(error);
  }
};
/* Inserts an anchor element that is specific to the page you are on (e.g. Explore) */
LeetCodeV1.prototype.insertToAnchorElement = function (elem) {
  if (document.URL.startsWith('https://leetcode.com/explore/')) {
    action = document.getElementsByClassName('action');
    if (
      checkElem(action) &&
      checkElem(action[0].getElementsByClassName('row')) &&
      checkElem(action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6')) &&
      action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6').length > 1
    ) {
      target = action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6')[1];
      elem.className = 'pull-left';
      if (target.childNodes.length > 0) target.childNodes[0].prepend(elem);
    }
  } else {
    if (checkElem(document.getElementsByClassName('action__38Xc'))) {
      target = document.getElementsByClassName('action__38Xc')[0];
      elem.className = 'runcode-wrapper__8rXm';
      if (target.childNodes.length > 0) target.childNodes[0].prepend(elem);
    }
  }
};
/* Creates a ✔️ tick mark before "Run Code" button signaling LeetHub has done its job */
LeetCodeV1.prototype.markUploaded = function () {
  elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid #78b13f;border-right:7px solid #78b13f;';
    elem.style = style;
  }
};
/* Creates a ❌ failed tick mark before "Run Code" button signaling that upload failed */
LeetCodeV1.prototype.markUploadFailed = function () {
  elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid red;border-right:7px solid red;';
    elem.style = style;
  }
};
LeetCodeV1.prototype.setProgressSpinnerId = function (progressSpinnerElementId) {
  this.progressSpinnerElementId = progressSpinnerElementId;
};
LeetCodeV1.prototype.setProgressSpinnerClass = function (progressSpinnerElementClass) {
  this.progressSpinnerElementClass = progressSpinnerElementClass;
};
/* Injects css style required for the upload progress indicator */
LeetCodeV1.prototype.injectSpinnerStyle = function () {
  const style = document.createElement('style');
  style.textContent = `.${this.progressSpinnerElementClass} {pointer-events: none;width: 2.0em;height: 2.0em;border: 0.4em solid transparent;border-color: #eee;border-top-color: #3E67EC;border-radius: 50%;animation: loadingspin 1s linear infinite;} @keyframes loadingspin { 100% { transform: rotate(360deg) }}`;
  document.head.append(style);
};

function LeetCodeV2() {
  this.progressSpinnerElementId = 'leethub_progress_elem';
  this.progressSpinnerElementClass = 'leethub_progress';
  this.injectSpinnerStyle();
}
LeetCodeV2.prototype.findAndUploadCode = function () {
  const code = document.getElementsByTagName('code');
  if (!checkElem(code)) {
    console.error('No solution code found');
    return null;
  }
  return code[0].innerText;
};
LeetCodeV2.prototype.findLanguage = function () {
  const tag = document.querySelector('button[id^="headlessui-listbox-button"]');
  if (!tag) {
    console.error('No language button found');
    return null;
  }

  const lang = tag.innerText;
  if (languages[lang] === undefined) {
    console.error('Unknown Language');
    return null;
  }

  return languages[lang];
};
LeetCodeV2.prototype.getNotesIfAny = function () {};
LeetCodeV2.prototype.parseStats = function () {
  const probStats = document.getElementsByClassName('flex w-full pb-4')[0].innerText.split('\n');
  if (!checkElem(probStats)) {
    return null;
  }

  const time = probStats[1];
  const timePercentile = probStats[3];
  const space = probStats[5];
  const spacePercentile = probStats[7];

  return `Time: ${time} (${timePercentile}), Space: ${space} (${spacePercentile}) - LeetHub`;
};
LeetCodeV2.prototype.parseQuestion = async function () {
  // Description
  let qBody = this.parseQuestionDescription();
  console.log("🚀 ~ file: leetcode.js:705 ~ qBody:", qBody)

  // Problem title.
  const titleSlug = convertToSlug(this.parseQuestionTitle())
  console.log("🚀 ~ file: leetcode.js:708 ~ qTitle:", qTitle)
  console.log("cookie", document.cookie)

  // Parse SubmissionId
  let URL = window.location.href
  let submissionId = parseInt(URL.split('/submissions/')[1].slice(0, -1))
  
  // This query will give you the solution runtime and memory stats, the code, the coding language, the question id, question title and question difficulty
  // let questionQuery = {"query":"\n    query questionTitle($titleSlug: String!) {\n  question(titleSlug: $titleSlug) {\n    questionId\n    questionFrontendId\n    title\n    titleSlug\n    isPaidOnly\n    difficulty\n    likes\n    dislikes\n  }\n}\n    ","variables":{"titleSlug":titleSlug},"operationName":"questionTitle"}
  let submissionDetailsQuery = {"query":"\n    query submissionDetails($submissionId: Int!) {\n  submissionDetails(submissionId: $submissionId) {\n    runtime\n    runtimeDisplay\n    runtimePercentile\n    runtimeDistribution\n    memory\n    memoryDisplay\n    memoryPercentile\n    memoryDistribution\n    code\n    timestamp\n    statusCode\n    lang {\n      name\n      verboseName\n    }\n    question {\n      questionId\n    title\n    titleSlug\n    difficulty\n    }\n    notes\n    topicTags {\n      tagId\n      slug\n      name\n    }\n    runtimeError\n  }\n}\n    ","variables":{"submissionId":submissionId},"operationName":"submissionDetails"}
  let options = {
    method: 'POST',
    headers: {
      cookie: document.cookie,
      'content-type': 'application/json'
    },
    body: JSON.stringify(submissionDetailsQuery)
  }
  const data = await fetch('https://leetcode.com/graphql/', options)
    .then(res => res.json())
    .then(res => res.data)
  console.log("🚀 ~ file: leetcode.js:723 ~ data:", data)
  

  // sample response data
  // {"data":{"submissionDetails":{"runtime":67,"runtimeDisplay":"67 ms","runtimePercentile":76.13729999999997,"runtimeDistribution":"{\"lang\": \"javascript\", \"distribution\": [[\"22\", 0.0058], [\"25\", 0.0019], [\"29\", 0.0039], [\"32\", 0.0019], [\"35\", 0.0019], [\"39\", 0.033100000000000004], [\"42\", 0.1422], [\"45\", 0.3646], [\"49\", 0.8482000000000001], [\"52\", 2.6790000000000003], [\"55\", 3.5174000000000003], [\"59\", 5.4144], [\"62\", 8.557500000000001], [\"65\", 6.8202], [\"69\", 5.9311], [\"72\", 4.2602], [\"75\", 3.1799999999999997], [\"78\", 1.2166000000000001], [\"82\", 0.7819], [\"85\", 0.8422000000000001], [\"88\", 0.8482000000000001], [\"92\", 1.2322], [\"95\", 2.5561], [\"98\", 2.6614], [\"102\", 3.295], [\"105\", 5.0888], [\"108\", 3.4374000000000002], [\"112\", 2.8642000000000003], [\"115\", 2.7277000000000005], [\"118\", 1.5539], [\"122\", 1.1835], [\"125\", 0.9476], [\"128\", 1.0471], [\"131\", 0.6317], [\"135\", 0.5908], [\"138\", 0.8286], [\"141\", 0.5362], [\"145\", 0.542], [\"148\", 0.7623], [\"151\", 0.5186000000000001], [\"155\", 0.5206000000000001], [\"158\", 0.7896000000000001], [\"161\", 0.8268], [\"165\", 1.0354], [\"168\", 1.6455], [\"171\", 1.3219], [\"175\", 1.5033], [\"178\", 1.396], [\"181\", 1.4292], [\"184\", 0.8248], [\"188\", 0.5517], [\"191\", 0.6004], [\"194\", 0.33530000000000004], [\"198\", 0.3159], [\"201\", 0.2807], [\"204\", 0.1559], [\"208\", 0.1774], [\"211\", 0.1988], [\"214\", 0.1521], [\"218\", 0.1384], [\"221\", 0.21430000000000002], [\"224\", 0.1169], [\"228\", 0.11699999999999999], [\"231\", 0.1091], [\"234\", 0.14029999999999998], [\"237\", 0.12279999999999999], [\"241\", 0.0877], [\"244\", 0.13649999999999998], [\"247\", 0.1072], [\"251\", 0.0857], [\"254\", 0.1482], [\"257\", 0.1364], [\"261\", 0.1111], [\"264\", 0.1617], [\"267\", 0.0877], [\"271\", 0.0857], [\"274\", 0.0934], [\"277\", 0.0721], [\"281\", 0.0857], [\"284\", 0.11299999999999999]]}","memory":45412000,"memoryDisplay":"45.4 MB","memoryPercentile":5.059500000000011,"memoryDistribution":"{\"lang\": \"javascript\", \"distribution\": [[\"39100\", 0.0019], [\"40500\", 0.0039], [\"40800\", 0.0078], [\"40900\", 0.0058], [\"41000\", 0.0214], [\"41100\", 0.0507], [\"41200\", 0.078], [\"41300\", 0.2281], [\"41400\", 0.2671], [\"41500\", 0.5713], [\"41600\", 1.1874], [\"41700\", 1.6475], [\"41800\", 2.3533], [\"41900\", 3.0708], [\"42000\", 3.9814], [\"42100\", 5.4515], [\"42200\", 6.4107], [\"42300\", 6.0988], [\"42400\", 6.4887], [\"42500\", 6.6837], [\"42600\", 6.3756], [\"42700\", 6.1046], [\"42800\", 4.4006], [\"42900\", 3.5271], [\"43000\", 3.4842], [\"43100\", 3.2132], [\"43200\", 3.1995], [\"43300\", 2.638], [\"43400\", 2.1038], [\"43500\", 1.8737], [\"43600\", 1.5247], [\"43700\", 1.2069], [\"43800\", 0.8618], [\"43900\", 0.6512], [\"44000\", 0.6122], [\"44100\", 0.5596], [\"44200\", 0.7019], [\"44300\", 0.7234], [\"44400\", 0.7292], [\"44500\", 0.774], [\"44600\", 0.7565], [\"44700\", 0.7838], [\"44800\", 0.7604], [\"44900\", 0.6493], [\"45000\", 0.5654], [\"45100\", 0.5128], [\"45200\", 0.3802], [\"45300\", 0.3393], [\"45400\", 0.3178]]}","code":"/**\n * v10 with event listener\n * @param {number[]} nums\n * @param {number} target\n * @return {number[]}\n */\nvar twoSum = function(nums, target) {\n    let subTarget = target\n    let mapArr = new Map();\n    \n    for (let i = 0; i < nums.length; i++) {        \n        subTarget = target - nums[i]\n        if (mapArr.has(subTarget)) {\n            return [i, mapArr.get(subTarget)]\n        }\n        mapArr.set(nums[i], [i])\n    }\n\n};","timestamp":1681498417,"statusCode":10,"user":{"username":"arunbhardwaj","profile":{"realName":"","userAvatar":"https://s3-us-west-1.amazonaws.com/s3-lc-upload/assets/default_avatar.jpg"}},"lang":{"name":"javascript","verboseName":"JavaScript"},"question":{"questionId":"1"},"notes":"","topicTags":[],"runtimeError":null,"compileError":null,"lastTestcase":""}}}
  const qNum = data.submissionDetails.question.questionId
  
  // let qNum = this.parseQuestionNumber();
  // console.log("🚀 ~ file: leetcode.js:710 ~ qNum:", qNum)
  // qNum = parseInt(qNum, 10); // remove leading zeros
  const qTitle = `${qNum}. ${qTitle}`;
  console.log("🚀 ~ file: leetcode.js:732 ~ qTitle:", qTitle)
  
  // Problem difficulty
  difficulty = data.question.difficulty
  // difficulty = this.parseDifficulty();
  // console.log("🚀 ~ file: leetcode.js:717 ~ difficulty:", difficulty)

  // Final formatting of the contents of the README for each problem
  const markdown = `<h2><a href="${questionUrl}">${qTitle}</a></h2><h3>${difficulty}</h3><hr>${qBody}`;
  return markdown;
};
LeetCodeV2.prototype.parseQuestionTitle = function () {
  let questionTitle = document
    .getElementsByTagName('title')[0]
    .innerText.split(' ')
    .slice(0, -2)
    .join(' ');

  if (questionTitle === '') {
    questionTitle = 'unknown-problem';
  }

  return questionTitle;
};
LeetCodeV2.prototype.parseQuestionDescription = function () {
  const description = document.getElementsByName('description');
  if (!checkElem(description)) {
    return null;
  }
  return description[0].content;
};
LeetCodeV2.prototype.parseQuestionNumber = async function () {
  let questionId
  if (!this.data) {
    let options = {
      method: 'GET',
      headers: {
        'Cookie': 'gr_user_id=c4ef5fad-30b7-46f1-b73e-b8c05fef2b62; csrftoken=aqFMRL1JOyXo7barS5s1zabOQly0baQCyOTHqzsLonZc3nc5A8lJJNTQW8vP5f8W',
        'Host': 'leetcode.com',
        'User-Agent': 'LeetHub/2.0'
      }
    }
    const URL = window.location.href
    console.log("🚀 ~ file: leetcode.js:755 ~ URL:", URL)
    questionId = await fetch(URL, options)
      .then(res => res.text()).then(html => {
        console.log("🚀 ~ file: leetcode.js:758 ~ .then ~ html:", html)
        const doc = new DOMParser().parseFromString(html, 'text/html');
        return doc.getElementById('__NEXT_DATA__').innerText
      }).then(data => {console.log(data); return JSON.parse(data)})
      .then(data => {
        this.data = data
        console.log({data})
        return data.props.pageProps.dehydratedState.queries[0].state.data.question.questionId
      })
      //POST leetcode.com/graphql/
      // ZDBtQGyfNfvazDSZ4hFPTmdh5e1IP6d4PKCAaQy4b3iSSh1P9AMACwrjtUwrmsoF
    //   let questionEditorDataQuery = {"query":"\n    query questionEditorData($titleSlug: String!) {\n  question(titleSlug: $titleSlug) {\n    questionId\n    questionFrontendId\n    codeSnippets {\n      lang\n      langSlug\n      code\n    }\n    envInfo\n    enableRunCode\n  }\n}\n    ","variables":{"titleSlug":"two-sum"},"operationName":"questionEditorData"}
    //   let options = {
    //     method: 'POST',
    //     headers: {
    //       'cookie': 'gr_user_id=c4ef5fad-30b7-46f1-b73e-b8c05fef2b62; csrftoken=ZDBtQGyfNfvazDSZ4hFPTmdh5e1IP6d4PKCAaQy4b3iSSh1P9AMACwrjtUwrmsoF; 87b5a3c3f1a55520_gr_last_sent_cs1=arunbhardwaj; __stripe_mid=b6287d2b-af1f-487c-b0df-3d8c28618c94d5d51a; __atuvc=3%7C15; __atssc=google%3B1; LEETCODE_SESSION=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJfYXV0aF91c2VyX2lkIjoiMjQ1NzcxMCIsIl9hdXRoX3VzZXJfYmFja2VuZCI6ImFsbGF1dGguYWNjb3VudC5hdXRoX2JhY2tlbmRzLkF1dGhlbnRpY2F0aW9uQmFja2VuZCIsIl9hdXRoX3VzZXJfaGFzaCI6IjA4ZWM0NWQ4MWJlMWEyMGNkNDRjYTkzYWJkMjhkZTY2NmZiYjRmNDQiLCJpZCI6MjQ1NzcxMCwiZW1haWwiOiJhcnVuLmIuOTVAZ21haWwuY29tIiwidXNlcm5hbWUiOiJhcnVuYmhhcmR3YWoiLCJ1c2VyX3NsdWciOiJhcnVuYmhhcmR3YWoiLCJhdmF0YXIiOiJodHRwczovL3MzLXVzLXdlc3QtMS5hbWF6b25hd3MuY29tL3MzLWxjLXVwbG9hZC9hc3NldHMvZGVmYXVsdF9hdmF0YXIuanBnIiwicmVmcmVzaGVkX2F0IjoxNjgxMzI1MDg2LCJpcCI6Ijk2LjIzMi4xMjMuMjAwIiwiaWRlbnRpdHkiOiI5ZWE2ZjU4MGJjMjE2YWUwM2YwMGQ5ZTVmZWU5NjY1ZiIsInNlc3Npb25faWQiOjM3Njc3MDk2LCJfc2Vzc2lvbl9leHBpcnkiOjEyMDk2MDB9.Tm9UHVoefdH_dhE7rre3pU75TQzHeOuVHo_P3OKCtoI; _gid=GA1.2.1438583426.1681484856; 87b5a3c3f1a55520_gr_session_id=4db4ed21-36c4-4c08-90c3-970a49f437e4; 87b5a3c3f1a55520_gr_last_sent_sid_with_cs1=4db4ed21-36c4-4c08-90c3-970a49f437e4; 87b5a3c3f1a55520_gr_session_id_4db4ed21-36c4-4c08-90c3-970a49f437e4=true; NEW_PROBLEMLIST_PAGE=1; _ga=GA1.1.2078669182.1680737411; __stripe_sid=fffebce6-c684-44d4-be4d-8d29b3fa7f60a8239c; 87b5a3c3f1a55520_gr_cs1=arunbhardwaj; _dd_s=rum=0&expire=1681496136410; _ga_CDRWKZTDEX=GS1.1.1681492989.14.1.1681495237.0.0.0',
    //       'content-type': 'application/json'
    //     },
    //     body: JSON.stringify(questionEditorDataQuery)
    //   }
    //   fetch('https://leetcode.com/graphql/', options)

    // let query = {"query":"\n    query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {\n  problemsetQuestionList: questionList(\n    categorySlug: $categorySlug\n    limit: $limit\n    skip: $skip\n    filters: $filters\n  ) {\n    total: totalNum\n    questions: data {\n      acRate\n      difficulty\n      freqBar\n      frontendQuestionId: questionFrontendId\n      isFavor\n      paidOnly: isPaidOnly\n      status\n      title\n      titleSlug\n      topicTags {\n        name\n        id\n        slug\n      }\n      hasSolution\n      hasVideoSolution\n    }\n  }\n}\n    ","variables":{"categorySlug":"","skip":0,"limit":50,"filters":{"searchKeywords":"Two Sum"}},"operationName":"problemsetQuestionList"}
    
  } else {
    questionId = this.data.props.pageProps.dehydratedState.queries[0].state.data.question.questionId
  }
  
  const maxQuestionNumLength = 4;
  // let title = document.getElementsByClassName('mr-2 text-lg font-medium text-label-1');
  // if (!checkElem(title)) {
  //   throw new Error('Could not parse question num');
  // }

  // title = title[0].innerText;
  // let num = title.split('.')[0];
  let num = questionId
  if (num.length < maxQuestionNumLength) {
    num = '0'.repeat(4 - num.length) + num;
  }

  return num;
};
LeetCodeV2.prototype.parseDifficulty = function () {
  const diffElement = document.getElementsByClassName('mt-3 flex space-x-4');
  if (checkElem(diffElement)) {
    return diffElement[0].children[0].innerText;
  }
  // Else, we're not on the description page. Nothing we can do.
  return 'unknown';
};
LeetCodeV2.prototype.getProblemNameSlug = function () {
  let questionTitle = convertToSlug(this.parseQuestionTitle());
  // let questionNum = this.parseQuestionNumber();

  return 'random' + '-' + questionTitle;
};
LeetCodeV2.prototype.getSuccessStateAndUpdate = function () {
  const successTag = document.querySelectorAll('[data-e2e-locator="submission-result"]');
  if (checkElem(successTag)) {
    console.log(successTag[0]);
    successTag[0].classList.add('marked_as_success');
    return true;
  }
  return false;
};
LeetCodeV2.prototype.startUploadSpinner = function () {
  console.log('starting spinner');
  try {
    elem = document.getElementById('leethub_progress_anchor_element');
    if (!elem) {
      elem = document.createElement('span');
      elem.id = 'leethub_progress_anchor_element';
      elem.style = 'margin-right: 20px;padding-top: 2px;';
    }
    elem.innerHTML = `<div id="${this.progressSpinnerElementId}" class="${this.progressSpinnerElementClass}">hi</div>`;
    this.insertToAnchorElement(elem);
    uploadState.uploading = true;
  } catch (error) {
    console.log(error);
  }
};
LeetCodeV2.prototype.insertToAnchorElement = function (elem) {
  // if (document.URL.startsWith('https://leetcode.com/explore/')) {
  //   action = document.getElementsByClassName('action');
  //   if (
  //     checkElem(action) &&
  //     checkElem(action[0].getElementsByClassName('row')) &&
  //     checkElem(action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6')) &&
  //     action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6').length > 1
  //   ) {
  //     target = action[0].getElementsByClassName('row')[0].getElementsByClassName('col-sm-6')[1];
  //     elem.className = 'pull-left';
  //     if (target.childNodes.length > 0) target.childNodes[0].prepend(elem);
  //   }
  // } else {
  if (checkElem(document.getElementsByClassName('ml-auto flex items-center space-x-4'))) {
    const target = document.getElementsByClassName('ml-auto flex items-center space-x-4')[0];
    elem.className = 'runcode-wrapper__8rXm';
    if (target.childNodes.length > 0) target.childNodes[0].prepend(elem);
  }
  // }
};
LeetCodeV2.prototype.markUploaded = function () {
  elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid #78b13f;border-right:7px solid #78b13f;';
    elem.style = style;
  }
};
LeetCodeV2.prototype.markUploadFailed = function () {
  elem = document.getElementById(this.progressSpinnerElementId);
  if (elem) {
    elem.className = '';
    style =
      'display: inline-block;transform: rotate(45deg);height:24px;width:12px;border-bottom:7px solid red;border-right:7px solid red;';
    elem.style = style;
  }
};
LeetCodeV2.prototype.setProgressSpinnerId = function (progressSpinnerElementId) {
  this.progressSpinnerElementId = progressSpinnerElementId;
};
LeetCodeV2.prototype.setProgressSpinnerClass = function (progressSpinnerElementClass) {
  this.progressSpinnerElementClass = progressSpinnerElementClass;
};
LeetCodeV2.prototype.injectSpinnerStyle = function () {
  const style = document.createElement('style');
  style.textContent = `.${this.progressSpinnerElementClass} {pointer-events: none;width: 2.0em;height: 2.0em;border: 0.4em solid transparent;border-color: #eee;border-top-color: #3E67EC;border-radius: 50%;animation: loadingspin 1s linear infinite;} @keyframes loadingspin { 100% { transform: rotate(360deg) }}`;
  document.head.append(style);
};

/* Sync to local storage */
chrome.storage.local.get('isSync', data => {
  keys = [
    'leethub_token',
    'leethub_username',
    'pipe_leethub',
    'stats',
    'leethub_hook',
    'mode_type',
  ];
  if (!data || !data.isSync) {
    keys.forEach(key => {
      chrome.storage.sync.get(key, data => {
        chrome.storage.local.set({ [key]: data[key] });
      });
    });
    chrome.storage.local.set({ isSync: true }, data => {
      console.log('LeetHub Synced to local values');
    });
  } else {
    console.log('LeetHub Local storage already synced!');
  }
});

let leetCode;
const isLeetCodeV2 = document.getElementById('chakra-script') != null;
if (!isLeetCodeV2) {
  leetCode = new LeetCodeV1();
} else {
  leetCode = new LeetCodeV2();
}

const loader = () => {
  const intervalId = setInterval(async () => {
    try {
      const isSuccessfulSubmission = leetCode.getSuccessStateAndUpdate();
      console.log(
        '🚀 ~ file: leetcode.js:878 ~ loader ~ isSuccessfulSubmission:',
        isSuccessfulSubmission,
      );
      if (!isSuccessfulSubmission) {
        return;
      }
  
      // const probStats = leetCode.parseStats();
      // console.log('🚀 ~ file: leetcode.js:884 ~ loader ~ probStats:', probStats);
      const probStatement = await leetCode.parseQuestion();
      console.log('🚀 ~ file: leetcode.js:886 ~ loader ~ probStatement:', probStatement);
      if (!probStatement) {
        console.error('Could not find problem statement');
        return;
      }
  
      // const problemName = leetCode.getProblemNameSlug();
      // console.log('🚀 ~ file: leetcode.js:893 ~ loader ~ problemName:', problemName);
      // const language = leetCode.findLanguage();
      // console.log('🚀 ~ file: leetcode.js:895 ~ loader ~ language:', language);
      // if (!language) {
      //   console.error('Could not find language');
      //   return;
      // }
    } catch (err) {
      console.error(err)
      clearInterval(intervalId)
    }

    // start upload indicator here
    leetCode.startUploadSpinner();

    /* Upload README */
    const updateReadMe = chrome.storage.local.get('stats').then(({ stats }) => {
      const shaExists = stats?.shas?.[problemName]?.[problemName + language] !== undefined;
      const sha = shaExists ? stats.shas[problemName][problemName + language] : undefined;

      if (!sha) {
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
    notes = leetCode.getNotesIfAny();
    let updateNotes;
    if (notes != undefined && notes.length > 0) {
      console.log('Create Notes');
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
    const updateCode = leetCode.findAndUploadCode(
      problemName,
      problemName + language,
      probStats,
      'upload',
    );

    await Promise.all([updateReadMe, updateNotes, updateCode])
      .then(() => {
        uploadState.uploading = false;
        leetCode.markUploaded();
        clearInterval(intervalId);
      })
      .catch(err => {
        uploadState.uploading = false;
        leetCode.markUploadFailed();
        console.error(err);
        clearInterval(intervalId);
      });
  }, 1000);
};

// TODO: have event listeners to be added once the button elements are loaded using Mutation Observer
// maybe this will help https://stackoverflow.com/questions/68329405/javascript-wait-until-element-loaded-on-website-using-chrome-extension
// Wait for the submit button to load
setTimeout(() => {
  const v1SubmitBtn = document.querySelector('[data-cy="submit-code-btn"]');
  const v2SubmitBtn = document.querySelector('[data-e2e-locator="console-submit-button"]');
  const elem = !isLeetCodeV2 ? v1SubmitBtn : v2SubmitBtn;
  elem.addEventListener('click', loader);
}, 2000);
