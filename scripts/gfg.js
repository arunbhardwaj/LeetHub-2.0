/* Enum for languages supported by GeeksForGeeks. */
const languages = {
  Python3: '.py',
  Python: '.py',
  'C++': '.cpp',
  C: '.c',
  Java: '.java',
  Javascript: '.js',
  JavaScript: '.js',
  'C#': '.cs',
};

/* Helper function to upload solutions to GitHub */
function uploadGit(code, problemName, filename, commitMsg, action, sha, cb, difficulty) {
  const api = typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' ? chrome : typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined' ? browser : null;
  if (!api) {
    console.error('LeetHub: Extension API not found.');
    return;
  }

  api.storage.local.get(['leethub_token', 'gfg_hook', 'mode_type', 'gfg_stats'], (data) => {
    const token = data.leethub_token;
    const hook = data.gfg_hook;
    const mode = data.mode_type;
    let stats = data.gfg_stats;

    if (!token || !hook || mode !== 'commit') {
      console.error('LeetHub: Not authenticated or repository not linked.');
      return;
    }

    if (!stats) {
      stats = { shas: {}, solved: 0, easy: 0, medium: 0, hard: 0 };
    }
    if (!stats.shas) {
      stats.shas = {};
    }
    if (!stats.shas[problemName]) {
      stats.shas[problemName] = {};
    }

    const currentSha = sha || stats.shas[problemName][filename] || '';
    const path = filename ? `${problemName}/${filename}` : problemName;
    const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

    const requestData = {
      message: commitMsg,
      content: code,
    };
    if (currentSha) {
      requestData.sha = currentSha;
    }

    fetch(URL, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(requestData),
    })
      .then((res) => {
        if (!res.ok) {
          throw new Error(res.status);
        }
        return res.json();
      })
      .then((body) => {
        stats.shas[problemName][filename] = body.content.sha;
        
        // Update stats counters if not README and it's a new solution commit
        if (filename !== 'README.md' && !currentSha) {
          stats.solved = (stats.solved || 0) + 1;
          let diff = (difficulty || '').toLowerCase().trim();
          if (diff.includes('easy')) {
            stats.easy = (stats.easy || 0) + 1;
            diff = 'easy';
          } else if (diff.includes('medium')) {
            stats.medium = (stats.medium || 0) + 1;
            diff = 'medium';
          } else if (diff.includes('hard')) {
            stats.hard = (stats.hard || 0) + 1;
            diff = 'hard';
          }
          stats.shas[problemName].difficulty = diff;
        }

        api.storage.local.set({ gfg_stats: stats }, () => {
          console.log(`Successfully committed ${path} to GitHub.`);
          if (cb) cb();
        });
      })
      .catch((err) => {
        console.error('LeetHub: Error uploading to GitHub:', err);
      });
  });
}

/* Commit messages */
const README_MSG = 'Create README - LeetHub';
const SUBMIT_MSG = 'Added solution - LeetHub';
const UPDATE_MSG = 'Updated solution - LeetHub';
let START_MONITOR = true;
const toKebabCase = (string) => {
  return string
    .replace(/[^a-zA-Z0-9\. ]/g, '') // remove special chars
    .replace(/([a-z])([A-Z])/g, '$1-$2') // get all lowercase letters that are near to uppercase ones
    .replace(/[\s_]+/g, '-') // replace all spaces and low dash
    .toLowerCase(); // convert to lower case
};

function findGfgLanguage() {
  const ele = document.querySelector('.divider.text')
    || document.querySelector('[class*="divider"][class*="text"]')
    || document.querySelector('[class*="language"]')
    || document.querySelector('.ant-select-selection-item');
  if (ele) {
    const lang = ele.innerText.split('(')[0].trim();
    if (lang.length > 0 && languages[lang]) {
      return languages[lang];
    }
  }
  return null;
}

function findTitle() {
  const ele = document.querySelector('[class*="problems_header_content__title"] > h3')
    || document.querySelector('[class*="problems_header_content__title"] h3')
    || document.querySelector('.problems_header_content__title h3')
    || document.querySelector('h3[class*="title"]')
    || document.querySelector('.problem-tab-title')
    || document.querySelector('h3');
  if (ele != null) {
    return ele.innerText.trim();
  }
  return '';
}

function findDifficulty() {
  const container = document.querySelector('[class*="problems_header_description"]')
    || document.querySelector('.problems_header_description')
    || document.querySelector('[class*="problems_header_description"]');
  if (container && container.children && container.children.length > 0) {
    let ele = container.children[0].innerText.trim();
    if (ele.toLowerCase().includes('difficulty:')) {
      ele = ele.replace(/difficulty:/i, '').trim();
    }
    if (ele === 'Basic' || ele === 'School') {
      return 'Easy';
    }
    return ele;
  }
  
  // Fallback search in body text
  const text = document.body.innerText;
  if (text.includes('Easy')) return 'Easy';
  if (text.includes('Medium')) return 'Medium';
  if (text.includes('Hard')) return 'Hard';
  if (text.includes('Basic') || text.includes('School')) return 'Easy';
  
  return '';
}

function getProblemStatement() {
  const ele = document.querySelector('[class*="problems_problem_content"]')
    || document.querySelector('.problems_problem_content')
    || document.querySelector('#problem-statement')
    || document.querySelector('.problem-description')
    || document.querySelector('[class*="problem-body"]');
  return ele ? `${ele.outerHTML}` : '';
}

function getCode() {
  try {
    const scriptContent = `
    var editor = ace.edit("ace-editor");
    var editorContent = editor.getValue();
    var para = document.createElement("pre");
    para.innerText+=editorContent;
    para.setAttribute("id","codeDataLeetHub")
    document.body.appendChild(para);
    `;

    var script = document.createElement('script');
    script.id = 'tmpScript';
    script.appendChild(document.createTextNode(scriptContent));
    (
      document.body ||
      document.head ||
      document.documentElement
    ).appendChild(script);
    const text = document.getElementById('codeDataLeetHub').innerText;

    const nodeDeletionScript = `
    document.body.removeChild(para)
    `;
    var script = document.createElement('script');
    script.id = 'tmpScript';
    script.appendChild(document.createTextNode(nodeDeletionScript));
    (
      document.body ||
      document.head ||
      document.documentElement
    ).appendChild(script);

    return text || '';
  } catch (e) {
    console.error('LeetHub: Error getting code from Ace editor:', e);
    // Fallback: try reading text content from standard editor lines if ace fails
    const codeLines = document.querySelectorAll('.ace_line');
    if (codeLines && codeLines.length > 0) {
      return Array.from(codeLines).map(l => l.innerText).join('\n');
    }
    return '';
  }
}

const gfgLoader = setInterval(() => {
  let code = null;
  let problemStatement = null;
  let title = null;
  let language = null;
  let difficulty = null;

  if (
    window.location.href.includes(
      'practice.geeksforgeeks.org/problems',
    ) ||
    window.location.href.includes(
      'geeksforgeeks.org/problems',
    )
  ) {

    const submitBtn = document.evaluate(".//button[text()='Submit']", document.body, null, XPathResult.ANY_TYPE, null).iterateNext()
      || document.querySelector('button.submit')
      || document.querySelector('button[type="submit"]')
      || Array.from(document.querySelectorAll('button')).find(btn => btn.innerText.trim() === 'Submit');

    if (!submitBtn) return;

    submitBtn.addEventListener('click', function () {
      START_MONITOR = true;
      const submission = setInterval(() => {
        try {
          const outputEl = document.querySelector('[class*="problems_content"]')
            || document.querySelector('.problems_content')
            || document.querySelector('.output_window')
            || document.querySelector('[class*="output"]');
          
          if (!outputEl) return;
          const output = outputEl.innerText;
          
          if (
            output.includes('Problem Solved Successfully') &&
            START_MONITOR
          ) {
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
            chrome.storage.local.get('gfg_stats', (s) => {
              const stats = s.gfg_stats;
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
                difficulty,
              );
              // }

              if (code !== '') {
                setTimeout(function () {
                  uploadGit(
                    btoa(unescape(encodeURIComponent(code))),
                    probName,
                    toKebabCase(title + language),
                    SUBMIT_MSG,
                    'upload',
                    undefined,
                    () => {
                      chrome.storage.local.get(['leethub_token', 'gfg_hook', 'gfg_stats'], (data) => {
                        const token = data.leethub_token;
                        const hook = data.gfg_hook;
                        const stats = data.gfg_stats;
                        if (token && hook) {
                          const topics = findGfgTopics();
                          updateGfgReadme(token, hook, title, difficulty, language, toKebabCase(title + language), topics);
                          if (stats) {
                            setPersistentGfgStats(token, hook, stats);
                          }
                        }
                      });
                    },
                    difficulty,
                  );
                }, 1000);
              }
            });
          }
        } else if (output.includes('Compilation Error')) {
          // clear timeout and do nothing
          clearInterval(submission);
        } else if (
          !START_MONITOR &&
          (output.includes('Compilation Error') ||
            output.includes('Correct Answer'))
        ) {
          clearInterval(submission);
        }
      } catch (err) {
        console.error('LeetHub: Error during submission check:', err);
        clearInterval(submission);
      }
    }, 1000);
    });
  }
}, 1000);

async function getGitHubFile(token, hook, path) {
  const URL = `https://api.github.com/repos/${hook}/contents/${path}`;
  const options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };
  const res = await fetch(URL, options);
  if (!res.ok) {
    throw new Error(res.status);
  }
  return res;
}

function findGfgTopics() {
  const tags = [];
  const tagElements = document.querySelectorAll('[class*="problems_tag_container"] a')
    || document.querySelectorAll('.problems_tag_container a')
    || document.querySelectorAll('[class*="tag-link"]')
    || document.querySelectorAll('.problem-tag')
    || document.querySelectorAll('.problems_tag_container__link');
    
  if (tagElements && tagElements.length > 0) {
    tagElements.forEach(el => {
      const tagText = el.innerText.trim();
      if (tagText && tagText.length > 0 && !tags.includes(tagText)) {
        tags.push(tagText);
      }
    });
  }

  if (tags.length === 0) {
    tags.push('Misc');
  }
  return tags;
}

const gfgSectionStart = `<!---GeeksforGeeks Topics Start-->`;
const gfgSectionHeader = `# GeeksforGeeks Topics`;
const gfgSectionEnd = `<!---GeeksforGeeks Topics End-->`;

function appendGfgProblemToReadme(topic, markdownFile, hook, problem) {
  const url = `https://github.com/${hook}/tree/master/${encodeURIComponent(problem)}`;
  const topicHeader = `## ${topic}`;
  const topicTableHeader = `\n${topicHeader}\n|  |\n| ------- |\n`;
  const newRow = `| [${problem}](${url}) |`;

  let gfgSectionStartIndex = markdownFile.indexOf(gfgSectionStart);
  if (gfgSectionStartIndex === -1) {
    markdownFile += '\n' + [gfgSectionStart, gfgSectionHeader, gfgSectionEnd].join('\n');
    gfgSectionStartIndex = markdownFile.indexOf(gfgSectionStart);
  }

  const beforeSection = markdownFile.slice(0, markdownFile.indexOf(gfgSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(gfgSectionEnd) + gfgSectionEnd.length,
  );

  let gfgSection = markdownFile.slice(
    markdownFile.indexOf(gfgSectionStart) + gfgSectionStart.length,
    markdownFile.indexOf(gfgSectionEnd),
  );

  let topicTableIndex = gfgSection.indexOf(topicHeader);
  if (topicTableIndex === -1) {
    gfgSection += topicTableHeader;
    topicTableIndex = gfgSection.indexOf(topicHeader);
  }

  const endTopicString = gfgSection.slice(topicTableIndex).match(/\|\n[^|]/)?.[0];
  const endTopicIndex = (endTopicString != null) ? gfgSection.indexOf(endTopicString, topicTableIndex + 1) : -1;
  let topicTable =
    endTopicIndex === -1
      ? gfgSection.slice(topicTableIndex)
      : gfgSection.slice(topicTableIndex, endTopicIndex + 1);
  topicTable = topicTable.trim();

  const problemIndex = topicTable.indexOf(problem);
  if (problemIndex !== -1) {
    return markdownFile;
  }

  topicTable = [topicTable, newRow, '\n'].join('\n');

  gfgSection =
    gfgSection.slice(0, topicTableIndex) +
    topicTable +
    (endTopicIndex === -1 ? '' : gfgSection.slice(endTopicIndex + 1));

  markdownFile = [
    beforeSection,
    gfgSectionStart,
    gfgSection,
    gfgSectionEnd,
    afterSection,
  ].join('');

  return markdownFile;
}

function sortGfgTopicsInReadme(markdownFile) {
  let beforeSection = markdownFile.slice(0, markdownFile.indexOf(gfgSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(gfgSectionEnd) + gfgSectionEnd.length,
  );

  const gfgSection = markdownFile.match(
    new RegExp(`${gfgSectionStart}([\\s\\S]*)${gfgSectionEnd}`),
  )?.[1];
  if (gfgSection == null) return markdownFile;

  let topics = gfgSection.trim().split('## ');
  topics.shift();

  topics = topics.map(section => {
    let lines = section.trim().split('\n');
    const topic = lines.shift();

    let topicHeaderIndex = markdownFile.indexOf(`## ${topic}`);
    let gfgSectionStartIndex = markdownFile.indexOf(gfgSectionStart);
    if (topicHeaderIndex < gfgSectionStartIndex) {
      const endTopicString = markdownFile.slice(topicHeaderIndex).match(/\|\n[^|]/)?.[0];
      if (endTopicString != null) {
        const endTopicIndex = markdownFile.indexOf(endTopicString, topicHeaderIndex + 1);
        const topicSection = markdownFile.slice(topicHeaderIndex, endTopicIndex + 1);
        const problemsToMerge = topicSection.trim().split('\n').slice(3);
        lines = lines.concat(problemsToMerge).reduce((array, element) => {
          if (!array.includes(element)) {
            array.push(element);
          }
          return array;
        }, []);
        beforeSection =
          markdownFile.slice(0, topicHeaderIndex) +
          markdownFile.slice(endTopicIndex + 1, markdownFile.indexOf(gfgSectionStart));
      }
    }

    lines = lines.slice(2);
    lines.sort((a, b) => a.localeCompare(b));

    return ['## ' + topic].concat('|  |', '| ------- |', lines).join('\n');
  });

  markdownFile =
    beforeSection +
    [gfgSectionStart, gfgSectionHeader, ...topics, gfgSectionEnd].join('\n') +
    afterSection;

  return markdownFile;
}

async function updateGfgReadme(token, hook, title, difficulty, language, fileName, topics) {
  const probName = `${title} - GFG`;
  let sha = '';
  let content = '';
  
  try {
    const res = await getGitHubFile(token, hook, 'README.md');
    const data = await res.json();
    sha = data.sha;
    content = decodeURIComponent(escape(atob(data.content)));
  } catch (err) {
    if (err.message !== '404') {
      console.error('LeetHub: Error fetching GFG root README:', err);
      return;
    }
  }

  if (!content) {
    content = `A collection of GeeksforGeeks questions solved on the platform. - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)\n`;
  }

  for (let topic of topics) {
    content = appendGfgProblemToReadme(topic, content, hook, probName);
  }
  content = sortGfgTopicsInReadme(content);

  const requestData = {
    message: 'Update README - Topic Tags - GFG',
    content: btoa(unescape(encodeURIComponent(content))),
  };
  if (sha) {
    requestData.sha = sha;
  }

  const URL = `https://api.github.com/repos/${hook}/contents/README.md`;
  await fetch(URL, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(requestData),
  });
}

async function setPersistentGfgStats(token, hook, localStats) {
  let sha = '';
  let content = '';

  try {
    const res = await getGitHubFile(token, hook, 'stats.json');
    const data = await res.json();
    sha = data.sha;
    content = decodeURIComponent(escape(atob(data.content)));
  } catch (err) {
    if (err.message !== '404') {
      console.error('LeetHub: Error fetching GFG stats.json:', err);
      return;
    }
  }

  let pStats = { gfg: localStats };
  if (content) {
    try {
      const parsed = JSON.parse(content);
      parsed.gfg = Object.assign({}, parsed.gfg, localStats);
      pStats = parsed;
    } catch (e) {
      console.error('LeetHub: Error parsing GFG stats.json content:', e);
    }
  }

  const statsEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(pStats))));
  const requestData = {
    message: 'Update stats - GFG',
    content: statsEncoded,
  };
  if (sha) {
    requestData.sha = sha;
  }

  const URL = `https://api.github.com/repos/${hook}/contents/stats.json`;
  await fetch(URL, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(requestData),
  });
}
