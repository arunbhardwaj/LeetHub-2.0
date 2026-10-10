const languages = {
  Python3: '.py',
  'C++': '.cpp',
  Java: '.java',
  Javascript: '.js',
};

/* Commit messages */
const README_MSG = 'Create README - LeetHub';
const SUBMIT_MSG = 'Added solution - LeetHub';
const UPDATE_MSG = 'Updated solution - LeetHub';
let START_MONITOR = true;
const toKebabCase = string => {
  return string
    .replace(/[^a-zA-Z0-9\. ]/g, '') // remove special chars
    .replace(/([a-z])([A-Z])/g, '$1-$2') // get all lowercase letters that are near to uppercase ones
    .replace(/[\s_]+/g, '-') // replace all spaces and low dash
    .toLowerCase(); // convert to lower case
};

async function uploadGit(
  content,
  problemName,
  filename,
  commitMsg,
  operation,
  sha,
  optionals,
  difficulty
) {
  try {
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['leethub_token', 'mode_type', 'leethub_hook', 'stats'], resolve);
    });

    const token = data.leethub_token;
    const hook = data.leethub_hook;

    if (!token) {
      throw new Error('LeetHub GitHub token not found');
    }

    if (!hook) {
      throw new Error('LeetHub GitHub repository not configured');
    }

    if (data.mode_type !== 'commit') {
      throw new Error('LeetHub is not authorized with GitHub');
    }

    const path = `${problemName}/${filename}`;
    const url = `https://api.github.com/repos/${hook}/contents/${path}`;

    let currentSha = sha || '';

    // Get existing file SHA if we don't already have it.
    if (!currentSha) {
      const existingResponse = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (existingResponse.ok) {
        const existingFile = await existingResponse.json();
        currentSha = existingFile.sha;
      }
    }

    const body = {
      message: commitMsg,
      content: content,
    };

    if (currentSha) {
      body.sha = currentSha;
    }

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    // Handle GitHub conflict by getting the latest SHA and retrying.
    if (response.status === 409) {
      const latestResponse = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
      });

      if (!latestResponse.ok) {
        throw new Error(`Unable to get existing GitHub file: ${latestResponse.status}`);
      }

      const latestFile = await latestResponse.json();

      body.sha = latestFile.sha;

      const retryResponse = await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!retryResponse.ok) {
        throw new Error(`GitHub upload failed: ${retryResponse.status}`);
      }

      const retryData = await retryResponse.json();

      console.log(`LeetHub: Successfully uploaded ${path} to GitHub`);

      updateGfgStats(data.stats, problemName, filename, retryData.content.sha, difficulty);

      return retryData;
    }

    if (!response.ok) {
      const errorText = await response.text();

      throw new Error(`GitHub upload failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    console.log(`LeetHub: Successfully uploaded ${path} to GitHub`);

    updateGfgStats(data.stats, problemName, filename, result.content.sha, difficulty);

    return result;
  } catch (error) {
    console.error('LeetHub GFG GitHub upload error:', error);
  }
}

function updateGfgStats(stats, problemName, filename, sha, difficulty) {
  if (!stats) {
    stats = {
      shas: {},
      solved: 0,
      easy: 0,
      medium: 0,
      hard: 0,
    };
  }

  if (!stats.shas) {
    stats.shas = {};
  }

  if (!stats.shas[problemName]) {
    stats.shas[problemName] = {};
  }

  stats.shas[problemName][filename] = sha;

  stats.solved = (stats.solved || 0) + 1;

  if (difficulty === 'Easy') {
    stats.easy = (stats.easy || 0) + 1;
  } else if (difficulty === 'Medium') {
    stats.medium = (stats.medium || 0) + 1;
  } else if (difficulty === 'Hard') {
    stats.hard = (stats.hard || 0) + 1;
  }

  chrome.storage.local.set({ stats });
}

async function updateGfgRepoReadme(problemName) {
  try {
    const data = await new Promise(resolve => {
      chrome.storage.local.get(['leethub_token', 'leethub_hook'], resolve);
    });

    const token = data.leethub_token;
    const hook = data.leethub_hook;

    if (!token || !hook) {
      return;
    }

    const url = `https://api.github.com/repos/${hook}/contents/README.md`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error(
        `LeetHub: Failed to fetch repository README: ${response.status}`,
      );
      return;
    }

    const readmeData = await response.json();

    const readme = decodeURIComponent(
      escape(atob(readmeData.content.replace(/\n/g, ''))),
    );

    const problemUrl = `https://github.com/${hook}/tree/master/${encodeURIComponent(problemName)}`;
    const problemEntry = `| [${problemName}](${problemUrl}) |`;

    // Do not add the problem if it already exists.
    if (readme.includes(problemEntry)) {
      return;
    }

    const gfgSection = /## GeeksforGeeks[\s\S]*?(?=\n## |\s*$)/;

    if (gfgSection.test(readme)) {
      const section = readme.match(gfgSection)[0];

      const updatedSection = `${section.trimEnd()}\n${problemEntry}\n`;

      var updatedReadme = readme.replace(gfgSection, updatedSection);
    } else {
      var updatedReadme =
        `${readme.trimEnd()}\n\n` +
        `## GeeksforGeeks\n\n` +
        `| Problem |\n` +
        `| ------- |\n` +
        `${problemEntry}\n`;
    }

    const encodedReadme = btoa(
      unescape(encodeURIComponent(updatedReadme)),
    );

    const uploadResponse = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Update README - GeeksforGeeks',
        content: encodedReadme,
        sha: readmeData.sha,
      }),
    });

    if (!uploadResponse.ok) {
      console.error(
        `LeetHub: Failed to update repository README: ${uploadResponse.status}`,
      );
      return;
    }

    console.log(
      `LeetHub: Successfully updated repository README with ${problemName}`,
    );
  } catch (error) {
    console.error('LeetHub GFG README update error:', error);
  }
}

function findGfgLanguage() {
  const ele = document.getElementsByClassName('divider text')[0].innerText;
  const lang = ele.split('(')[0].trim();
  if (lang.length > 0 && languages[lang]) {
    return languages[lang];
  }
  return null;
}

function findTitle() {
  const ele = document.querySelector('[class^="problems_header_content__title"] > h3').innerText;
  if (ele != null) {
    return ele;
  }
  return '';
}

function findDifficulty() {
  const ele = document.querySelectorAll('[class^="problems_header_description"]')[0].children[0]
    .innerText;

  if (ele != null) {
    if (ele.trim() == 'Basic' || ele.trim() === 'School') {
      return 'Easy';
    }
    return ele;
  }
  return '';
}

function getProblemStatement() {
  const ele = document.querySelector('[class^="problems_problem_content"]');
  return `${ele.outerHTML}`;
}

function getCode() {
  const editor = document.getElementById('ace-editor');

  if (!editor) {
    console.error('LeetHub: GFG Ace editor not found');
    return '';
  }

  const lines = editor.querySelectorAll('.ace_line');

  if (lines.length === 0) {
    console.error('LeetHub: GFG editor content not found');
    return '';
  }

  return Array.from(lines)
    .map(line => line.innerText)
    .join('\n');
}

const gfgLoader = setInterval(() => {
  let code = null;
  let problemStatement = null;
  let title = null;
  let language = null;
  let difficulty = null;

  if (window.location.href.includes('www.geeksforgeeks.org/problems')) {
    const submitBtn = document
      .evaluate(".//button[text()='Submit']", document.body, null, XPathResult.ANY_TYPE, null)
      .iterateNext();

    submitBtn.addEventListener('click', function () {
      START_MONITOR = true;
      const submission = setInterval(() => {
        const output = document.querySelectorAll('[class^="problems_content"]')[0].innerText;
        if (output.includes('Problem Solved Successfully') && START_MONITOR) {
          // clear timeout
          START_MONITOR = false;
          clearInterval(gfgLoader);
          clearInterval(submission);
          // get data
          title = findTitle().trim();
          difficulty = findDifficulty();
          problemStatement = getProblemStatement();
          code = getCode();
          language = findGfgLanguage();

          // format data
          const probName = `${title} - GFG`;

          problemStatement = `# ${title}\n## ${difficulty}\n${problemStatement}`;

          // if language was found
          if (language !== null) {
            chrome.storage.local.get('stats', s => {
              const { stats } = s;
              const fileName = toKebabCase(title + language);
              const filePath = probName + fileName;
              let sha = null;
              if (
                stats !== undefined &&
                stats.shas !== undefined &&
                stats.shas[probName] !== undefined &&
                stats.shas[probName][fileName] !== undefined
              ) {
                sha = stats.shas[probName][fileName];
              }

              // Only create README if not already created
              // if (sha === null) {
              uploadGit(
                btoa(unescape(encodeURIComponent(problemStatement))),
                probName,
                'README.md',
                README_MSG,
                'upload',
                undefined,
                undefined,
                difficulty
              );
              // }

              if (code !== '') {
                setTimeout(async function () {
                  await uploadGit(
                    btoa(unescape(encodeURIComponent(code))),
                    probName,
                    toKebabCase(title + language),
                    SUBMIT_MSG,
                    'upload',
                    undefined,
                    undefined,
                    difficulty
                  );

                  await updateGfgRepoReadme(probName);
                }, 1000);
              }
            });
          }
        } else if (output.includes('Compilation Error')) {
          // clear timeout and do nothing
          clearInterval(submission);
        } else if (
          !START_MONITOR &&
          (output.includes('Compilation Error') || output.includes('Correct Answer'))
        ) {
          clearInterval(submission);
        }
      }, 1000);
    });
  }
}, 1000);
