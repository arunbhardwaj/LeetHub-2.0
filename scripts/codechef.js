/* Enum for languages supported by CodeChef. */
const languages = {
  'pypy 3': '.py',
  python3: '.py',
  python: '.py',
  'c++17': '.cpp',
  'c++20': '.cpp',
  'c++': '.cpp',
  c: '.c',
  java: '.java',
  javascript: '.js',
  'c#': '.cs',
  go: '.go',
  rust: '.rs',
  kotlin: '.kt',
  swift: '.swift',
};

/* Helper function to upload solutions to GitHub */
function uploadGit(code, problemName, filename, commitMsg, action, sha, cb, difficulty) {
  const api = typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined' ? chrome : typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined' ? browser : null;
  if (!api) {
    console.error('LeetHub: Extension API not found.');
    return;
  }

  api.storage.local.get(['leethub_token', 'codechef_hook', 'mode_type', 'codechef_stats'], (data) => {
    const token = data.leethub_token;
    const hook = data.codechef_hook;
    const mode = data.mode_type;
    let stats = data.codechef_stats;

    if (!token || !hook || mode !== 'commit') {
      console.error('LeetHub: Not authenticated or repository not linked.');
      return;
    }

    const path = problemName + '/' + filename;
    const URL = `https://api.github.com/repos/${hook}/contents/${path}`;

    if (stats === undefined || stats === '') {
      stats = {
        solved: 0,
        easy: 0,
        medium: 0,
        hard: 0,
        shas: {},
      };
    }
    if (stats.shas === undefined) {
      stats.shas = {};
    }

    let currentSha = null;
    if (stats.shas[problemName] !== undefined && stats.shas[problemName][filename] !== undefined) {
      currentSha = stats.shas[problemName][filename];
    }

    const requestData = {
      message: commitMsg,
      content: code,
    };
    if (currentSha !== null) {
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
      .then((res) => {
        const newSha = res.content.sha;
        if (stats.shas[problemName] === undefined) {
          stats.shas[problemName] = {};
        }
        stats.shas[problemName][filename] = newSha;

        // Update stats counters if it's a new code solution commit (not README)
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

        api.storage.local.set({ codechef_stats: stats }, () => {
          console.log(`Successfully committed ${path} to GitHub.`);
          if (cb) cb();
        });
      })
      .catch((err) => {
        console.error('LeetHub: Error uploading to GitHub:', err);
      });
  });
}

const README_MSG = 'Create README - LeetHub';
const SUBMIT_MSG = 'Added solution - LeetHub';
let START_MONITOR = true;

const toKebabCase = (string) => {
  return string
    .replace(/[^a-zA-Z0-9\. ]/g, '') // remove special chars
    .replace(/([a-z])([A-Z])/g, '$1-$2') // get all lowercase letters that are near to uppercase ones
    .replace(/[\s_]+/g, '-') // replace all spaces and low dash
    .toLowerCase(); // convert to lower case
};

const toSnakeCase = (string) => {
  return string
    .replace(/[^a-zA-Z0-9\. ]/g, '') // remove special chars
    .replace(/([a-z])([A-Z])/g, '$1_$2') // get all lowercase letters that are near to uppercase ones
    .replace(/[\s\-]+/g, '_') // replace all spaces and hyphens with underscores
    .toLowerCase(); // convert to lower case
};

function findCodeChefLanguage() {
  const langElement = document.querySelector('[class*="select-language"]')
    || document.querySelector('.select-language')
    || document.querySelector('[class*="language-select"]')
    || document.querySelector('.language-select')
    || document.querySelector('div[class*="selected-language"]');
    
  if (langElement) {
    const text = langElement.innerText.toLowerCase().trim();
    for (let key in languages) {
      if (text.includes(key)) {
        return languages[key];
      }
    }
  }
  return '.cpp'; // default fallback
}

function findDifficulty() {
  const diffElement = document.querySelector('[class*="difficulty"]')
    || document.querySelector('.difficulty')
    || document.querySelector('[class*="problem-difficulty"]')
    || document.querySelector('[class*="_value_lvmtf_"]');

  if (diffElement) {
    let text = diffElement.innerText.toLowerCase().trim();
    if (text.includes('easy') || text.includes('beginner') || text.includes('basic') || text.includes('school')) return 'Easy';
    if (text.includes('medium')) return 'Medium';
    if (text.includes('hard') || text.includes('challenge')) return 'Hard';
  }

  const ratingElement = document.querySelector('[class*="rating"]')
    || document.querySelector('.rating-value')
    || document.querySelector('span[class*="rating"]');
  if (ratingElement) {
    const rating = parseInt(ratingElement.innerText.replace(/[^0-9]/g, ''));
    if (!isNaN(rating)) {
      if (rating < 1400) return 'Easy';
      if (rating < 1800) return 'Medium';
      return 'Hard';
    }
  }

  return 'Easy'; // default fallback
}

function findRating() {
  const ratingElement = document.querySelector('[class*="rating"]')
    || document.querySelector('.rating-value')
    || document.querySelector('span[class*="rating"]');
  if (ratingElement) {
    const rating = parseInt(ratingElement.innerText.replace(/[^0-9]/g, ''));
    if (!isNaN(rating)) {
      return rating;
    }
  }
  const match = window.location.href.match(/DIFF(\d+)/i);
  if (match) {
    return parseInt(match[1]);
  }
  return null;
}

function sanitizeTitle(text) {
  if (!text) return '';
  let cleaned = text.split('\n')[0].trim();
  if (
    cleaned.toLowerCase().includes('tutor') || 
    cleaned.toLowerCase().includes('welcome') ||
    cleaned.toLowerCase() === 'codechef'
  ) {
    return '';
  }
  return cleaned.replace(/\([A-Z0-9]+\)$/i, '').trim();
}

function findTitle() {
  const titleElement = document.querySelector('#problem-statement h1')
    || document.querySelector('.problem-title')
    || document.querySelector('h1[class*="title"]')
    || document.querySelector('#problem-statement h2');
    
  if (titleElement) {
    const text = sanitizeTitle(titleElement.innerText);
    if (text) return text;
  }
  
  const h1s = document.querySelectorAll('h1');
  for (let h1 of h1s) {
    const text = sanitizeTitle(h1.innerText);
    if (text) return text;
  }
  
  const urlParts = window.location.pathname.split('/');
  const code = urlParts[urlParts.length - 1] || 'CodeChef Problem';
  return code;
}

function getProblemStatement() {
  const statement = document.querySelector('#problem-statement')
    || document.querySelector('.problem-statement')
    || document.querySelector('[class*="problem-statement"]');
  return statement ? statement.innerText.trim() : 'Problem statement not found.';
}

function getCode() {
  try {
    const scriptId = 'leethub-code-extractor';
    const dataNodeId = 'leethub-extracted-code';
    
    // Clean up any old data node
    const oldNode = document.getElementById(dataNodeId);
    if (oldNode) oldNode.remove();

    // script content to run in page context
    const scriptContent = `
      (function() {
        let code = '';
        try {
          if (typeof monaco !== 'undefined') {
            const models = monaco.editor.getModels();
            if (models && models.length > 0) {
              code = models[0].getValue();
            }
          }
        } catch(e) {}
        
        if (!code) {
          try {
            if (typeof ace !== 'undefined') {
              const editors = document.querySelectorAll('.ace_editor');
              if (editors && editors.length > 0) {
                const editor = ace.edit(editors[0].id);
                code = editor.getValue();
              }
            }
          } catch(e) {}
        }
        
        const para = document.createElement("pre");
        para.innerText = code;
        para.setAttribute("id", "${dataNodeId}");
        para.style.display = "none";
        document.body.appendChild(para);
      })();
    `;

    const script = document.createElement('script');
    script.id = scriptId;
    script.appendChild(document.createTextNode(scriptContent));
    (document.body || document.head || document.documentElement).appendChild(script);
    script.remove(); // remove script tag immediately after execution

    const textEl = document.getElementById(dataNodeId);
    const codeText = textEl ? textEl.innerText : '';
    if (textEl) textEl.remove(); // clean up the data node

    if (codeText && codeText.trim() !== '') {
      return codeText;
    }
  } catch (e) {
    console.error('LeetHub: Error extracting code via page context injection:', e);
  }

  // Fallbacks:
  const lines = document.querySelectorAll('.view-line');
  if (lines && lines.length > 0) {
    return Array.from(lines).map(line => line.innerText).join('\n');
  }

  const aceLines = document.querySelectorAll('.ace_line');
  if (aceLines && aceLines.length > 0) {
    return Array.from(aceLines).map(line => line.innerText).join('\n');
  }

  const textarea = document.querySelector('textarea.inputarea')
    || document.querySelector('textarea.ace_text-input')
    || document.querySelector('.editor textarea');
  if (textarea) {
    return textarea.value;
  }

  return '';
}

console.log("LeetHub: CodeChef content script injected!");

let IS_SUBMITTING = false;
let cachedTitle = '';
let cachedDifficulty = 'Easy';
let cachedProblemStatement = '';
let cachedTopics = [];
let cachedRating = null;
let lastUrl = window.location.href;

function findTitleFromSolutionPage() {
  const link = document.querySelector('a[href*="/problems/"]')
    || document.querySelector('.problem-link')
    || document.querySelector('a[href*="/submit/"]')
    || document.querySelector('h1 a')
    || document.querySelector('[class*="problem-link"]');
  if (link) {
    const text = sanitizeTitle(link.innerText);
    if (text) return text;
  }
  const h1s = document.querySelectorAll('h1');
  for (let h1 of h1s) {
    const text = sanitizeTitle(h1.innerText);
    if (text) return text;
  }
  return 'CodeChef Problem';
}

function findLanguageFromSolutionPage() {
  const details = document.body.innerText.toLowerCase();
  for (let key in languages) {
    if (details.includes(key)) {
      return languages[key];
    }
  }
  return '.cpp';
}

const codechefLoader = setInterval(() => {
  const url = window.location.href;

  if (url !== lastUrl) {
    console.log("LeetHub: CodeChef navigation detected from " + lastUrl + " to " + url + ". Resetting state.");
    lastUrl = url;
    IS_SUBMITTING = false;
    cachedTitle = '';
    cachedDifficulty = 'Easy';
    cachedProblemStatement = '';
    cachedTopics = [];
    cachedRating = null;
  }
  
  if (url.includes('/problems/') || url.includes('/submit/')) {
    try {
      const problemStatementEl = document.querySelector('#problem-statement') 
        || document.querySelector('.problem-statement')
        || document.querySelector('[class*="problem-statement"]');
      const problemText = problemStatementEl ? problemStatementEl.innerText : '';
      
      // Cache details if available in the DOM
      if (problemText && problemText.trim() !== '' && problemText.trim() !== 'Problem statement not found.') {
        cachedProblemStatement = problemText.trim();
      }
      const currentTitle = findTitle();
      if (currentTitle && currentTitle !== 'CodeChef Problem') {
        cachedTitle = currentTitle.trim();
      }
      const currentDifficulty = findDifficulty();
      if (currentDifficulty) {
        cachedDifficulty = currentDifficulty;
      }
      const currentRating = findRating();
      if (currentRating) {
        cachedRating = currentRating;
      }
      const currentTopics = findCodeChefTopics();
      if (currentTopics && currentTopics.length > 0) {
        cachedTopics = currentTopics;
      }

      const pageText = document.body.innerText.replace(problemText, '').toLowerCase();

      // Check if it's running/evaluating
      const isRunning = pageText.includes('running') || 
                        pageText.includes('evaluating') || 
                        pageText.includes('compiling') || 
                        pageText.includes('submitting') || 
                        pageText.includes('judging') || 
                        pageText.includes('queued') ||
                        pageText.includes('testing') ||
                        document.querySelector('[class*="spinner"]') ||
                        document.querySelector('.spinner') ||
                        document.querySelector('[class*="progress"]');

      if (isRunning) {
        if (!IS_SUBMITTING) {
          console.log("LeetHub: CodeChef submission running detected (via body text).");
          IS_SUBMITTING = true;
        }
      }

      // Check if completed successfully
      if (IS_SUBMITTING) {
        const isAccepted = pageText.includes('accepted') || 
                           pageText.includes('correct') || 
                           pageText.includes('100/100') ||
                           pageText.includes('100 pts');

        if (isAccepted) {
          console.log("LeetHub: CodeChef Accepted submission detected! Scheduling upload in 1.5 seconds...");
          IS_SUBMITTING = false;

          setTimeout(async () => {
            let title = cachedTitle || findTitle().trim();
            let difficulty = cachedDifficulty || findDifficulty();
            let language = findCodeChefLanguage();
            let problemStatement = `# ${title}\n## Difficulty: ${difficulty}\n\n` + (cachedProblemStatement || getProblemStatement());
            const ratingPrefix = cachedRating ? `${cachedRating}_` : '';
            const probName = ratingPrefix + toSnakeCase(title);
            const fileName = probName + language;

            // Find submission ID first to fetch full code
            const solutionLink = document.querySelector('a[href*="viewsolution"]')
              || document.querySelector('a[href*="/viewsolution/"]');
            let submissionId = null;
            if (solutionLink) {
              const match = solutionLink.href.match(/viewsolution\/(\d+)/);
              if (match) {
                submissionId = match[1];
              }
            }

            const uploadProcess = (finalCode) => {
              if (language !== null) {
                chrome.storage.local.get('codechef_stats', (s) => {
                  const stats = s.codechef_stats;
                  let sha = null;
                  if (
                    stats !== undefined &&
                    stats.shas !== undefined &&
                    stats.shas[probName] !== undefined &&
                    stats.shas[probName][fileName] !== undefined
                  ) {
                    sha = stats.shas[probName][fileName];
                  }

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

                  if (finalCode !== '') {
                    setTimeout(function () {
                      uploadGit(
                        btoa(unescape(encodeURIComponent(finalCode))),
                        probName,
                        fileName,
                        SUBMIT_MSG,
                        'upload',
                        undefined,
                        () => {
                          chrome.storage.local.get(['leethub_token', 'codechef_hook', 'codechef_stats'], (data) => {
                            const token = data.leethub_token;
                            const hook = data.codechef_hook;
                            const stats = data.codechef_stats;
                            if (token && hook) {
                              const topics = cachedTopics.length > 0 ? cachedTopics : findCodeChefTopics();
                              updateCodeChefReadme(token, hook, title, difficulty, language, fileName, topics);
                              if (stats) {
                                setPersistentCodeChefStats(token, hook, stats);
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
            };

            if (submissionId) {
              console.log("LeetHub: Fetching solution via CodeChef submission ID: " + submissionId);
              const fetchedCode = await fetchSubmissionCode(submissionId);
              const finalCode = fetchedCode || getCode();
              uploadProcess(finalCode);
            } else {
              console.log("LeetHub: No submission ID found, falling back to DOM editor scraper.");
              const finalCode = getCode();
              uploadProcess(finalCode);
            }
          }, 1500);
        } else {
          const isFailed = pageText.includes('compilation error') || 
                           pageText.includes('incorrect') ||
                           pageText.includes('runtime error') ||
                           pageText.includes('time limit exceeded') ||
                           pageText.includes('wrong');
          if (isFailed) {
            console.log("LeetHub: CodeChef submission failed/completed with non-accepted status.");
            IS_SUBMITTING = false;
          }
        }
      }
    } catch (err) {
      console.error('LeetHub: Error during submission check:', err);
    }
  } else if (url.includes('/viewsolution/')) {
    try {
      const verdictEl = document.querySelector('[class*="verdict"]')
        || document.querySelector('.verdict')
        || document.querySelector('.submission-verdict')
        || document.querySelector('[class*="status"]')
        || document.querySelector('.status-value')
        || document.body;

      const verdict = verdictEl.innerText.toLowerCase();
      if (
        verdict.includes('accepted') || 
        verdict.includes('correct') || 
        verdict.includes('100/100') ||
        verdict.includes('100 pts')
      ) {
        const parts = window.location.pathname.split('/');
        const submissionId = parts[parts.length - 1] || parts[parts.length - 2];
        if (!submissionId || isNaN(submissionId)) return;

        chrome.storage.local.get('processed_submissions', (data) => {
          let processed = data.processed_submissions || [];
          if (processed.includes(submissionId)) {
            return;
          }

          console.log("LeetHub: Direct solution page sync detected for ID: " + submissionId);
          processed.push(submissionId);
          chrome.storage.local.set({ processed_submissions: processed });

          let title = findTitleFromSolutionPage();
          let difficulty = 'Easy'; // default fallback
          let problemStatement = `# ${title}\n## Difficulty: ${difficulty}\n\nLink to problem: [CodeChef - ${title}](https://www.codechef.com/problems/${title})`;
          let language = findLanguageFromSolutionPage();
          const ratingPrefix = cachedRating ? `${cachedRating}_` : '';
          const probName = ratingPrefix + toSnakeCase(title);
          const fileName = probName + language;

          fetchSubmissionCode(submissionId).then(finalCode => {
            if (!finalCode) return;

            chrome.storage.local.get('codechef_stats', (s) => {
              const stats = s.codechef_stats;
              let sha = null;
              if (
                stats !== undefined &&
                stats.shas !== undefined &&
                stats.shas[probName] !== undefined &&
                stats.shas[probName][fileName] !== undefined
              ) {
                sha = stats.shas[probName][fileName];
              }

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

              setTimeout(function () {
                uploadGit(
                  btoa(unescape(encodeURIComponent(finalCode))),
                  probName,
                  fileName,
                  SUBMIT_MSG,
                  'upload',
                  undefined,
                  () => {
                    chrome.storage.local.get(['leethub_token', 'codechef_hook', 'codechef_stats'], (data2) => {
                      const token = data2.leethub_token;
                      const hook = data2.codechef_hook;
                      const stats2 = data2.codechef_stats;
                      if (token && hook) {
                        const topics = ['Misc'];
                        updateCodeChefReadme(token, hook, title, difficulty, language, fileName, topics);
                        if (stats2) {
                          setPersistentCodeChefStats(token, hook, stats2);
                        }
                      }
                    });
                  },
                  difficulty,
                );
              }, 1000);
            });
          });
        });
      }
    } catch (err) {
      console.error('LeetHub: Error during solution page check:', err);
    }
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

function findCodeChefTopics() {
  const tags = [];
  const tagElements = document.querySelectorAll('[class*="problem-tag"]')
    || document.querySelectorAll('.problem-tag')
    || document.querySelectorAll('[class*="tag-link"]')
    || document.querySelectorAll('.tag a');

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

const codechefSectionStart = `<!---CodeChef Topics Start-->`;
const codechefSectionHeader = `# CodeChef Topics`;
const codechefSectionEnd = `<!---CodeChef Topics End-->`;

function appendCodeChefProblemToReadme(topic, markdownFile, hook, problem) {
  const url = `https://github.com/${hook}/tree/master/${encodeURIComponent(problem)}`;
  const topicHeader = `## ${topic}`;
  const topicTableHeader = `\n${topicHeader}\n|  |\n| ------- |\n`;
  const newRow = `| [${problem}](${url}) |`;

  let codechefSectionStartIndex = markdownFile.indexOf(codechefSectionStart);
  if (codechefSectionStartIndex === -1) {
    markdownFile += '\n' + [codechefSectionStart, codechefSectionHeader, codechefSectionEnd].join('\n');
    codechefSectionStartIndex = markdownFile.indexOf(codechefSectionStart);
  }

  const beforeSection = markdownFile.slice(0, markdownFile.indexOf(codechefSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(codechefSectionEnd) + codechefSectionEnd.length,
  );

  let codechefSection = markdownFile.slice(
    markdownFile.indexOf(codechefSectionStart) + codechefSectionStart.length,
    markdownFile.indexOf(codechefSectionEnd),
  );

  let topicTableIndex = codechefSection.indexOf(topicHeader);
  if (topicTableIndex === -1) {
    codechefSection += topicTableHeader;
    topicTableIndex = codechefSection.indexOf(topicHeader);
  }

  const endTopicString = codechefSection.slice(topicTableIndex).match(/\|\n[^|]/)?.[0];
  const endTopicIndex = (endTopicString != null) ? codechefSection.indexOf(endTopicString, topicTableIndex + 1) : -1;
  let topicTable =
    endTopicIndex === -1
      ? codechefSection.slice(topicTableIndex)
      : codechefSection.slice(topicTableIndex, endTopicIndex + 1);
  topicTable = topicTable.trim();

  const problemIndex = topicTable.indexOf(problem);
  if (problemIndex !== -1) {
    return markdownFile;
  }

  topicTable = [topicTable, newRow, '\n'].join('\n');

  codechefSection =
    codechefSection.slice(0, topicTableIndex) +
    topicTable +
    (endTopicIndex === -1 ? '' : codechefSection.slice(endTopicIndex + 1));

  markdownFile = [
    beforeSection,
    codechefSectionStart,
    codechefSection,
    codechefSectionEnd,
    afterSection,
  ].join('');

  return markdownFile;
}

function sortCodeChefTopicsInReadme(markdownFile) {
  let beforeSection = markdownFile.slice(0, markdownFile.indexOf(codechefSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(codechefSectionEnd) + codechefSectionEnd.length,
  );

  const codechefSection = markdownFile.match(
    new RegExp(`${codechefSectionStart}([\\s\\S]*)${codechefSectionEnd}`),
  )?.[1];
  if (codechefSection == null) return markdownFile;

  let topics = codechefSection.trim().split('## ');
  topics.shift();

  topics = topics.map(section => {
    let lines = section.trim().split('\n');
    const topic = lines.shift();

    let topicHeaderIndex = markdownFile.indexOf(`## ${topic}`);
    let codechefSectionStartIndex = markdownFile.indexOf(codechefSectionStart);
    if (topicHeaderIndex < codechefSectionStartIndex) {
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
          markdownFile.slice(endTopicIndex + 1, markdownFile.indexOf(codechefSectionStart));
      }
    }

    lines = lines.slice(2);
    lines.sort((a, b) => a.localeCompare(b));

    return ['## ' + topic].concat('|  |', '| ------- |', lines).join('\n');
  });

  markdownFile =
    beforeSection +
    [codechefSectionStart, codechefSectionHeader, ...topics, codechefSectionEnd].join('\n') +
    afterSection;

  return markdownFile;
}

async function updateCodeChefReadme(token, hook, title, difficulty, language, fileName, topics) {
  const probName = `${title} - CodeChef`;
  let sha = '';
  let content = '';

  try {
    const res = await getGitHubFile(token, hook, 'README.md');
    const data = await res.json();
    sha = data.sha;
    content = decodeURIComponent(escape(atob(data.content)));
  } catch (err) {
    if (err.message !== '404') {
      console.error('LeetHub: Error fetching CodeChef root README:', err);
      return;
    }
  }

  if (!content) {
    content = `A collection of CodeChef questions solved on the platform. - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)\n`;
  }

  for (let topic of topics) {
    content = appendCodeChefProblemToReadme(topic, content, hook, probName);
  }
  content = sortCodeChefTopicsInReadme(content);

  const requestData = {
    message: 'Update README - Topic Tags - CodeChef',
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

async function setPersistentCodeChefStats(token, hook, localStats) {
  let sha = '';
  let content = '';

  try {
    const res = await getGitHubFile(token, hook, 'stats.json');
    const data = await res.json();
    sha = data.sha;
    content = decodeURIComponent(escape(atob(data.content)));
  } catch (err) {
    if (err.message !== '404') {
      console.error('LeetHub: Error fetching CodeChef stats.json:', err);
      return;
    }
  }

  let pStats = { codechef: localStats };
  if (content) {
    try {
      const parsed = JSON.parse(content);
      parsed.codechef = Object.assign({}, parsed.codechef, localStats);
      pStats = parsed;
    } catch (e) {
      console.error('LeetHub: Error parsing CodeChef stats.json content:', e);
    }
  }

  const statsEncoded = btoa(unescape(encodeURIComponent(JSON.stringify(pStats))));
  const requestData = {
    message: 'Update stats - CodeChef',
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

async function fetchSubmissionCode(submissionId) {
  const plainCodeURL = "https://www.codechef.com/viewplaintext/";
  try {
    const response = await fetch(plainCodeURL + submissionId);
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const preTag = doc.querySelector('pre');
    if (preTag) {
      const codeContent = preTag.innerHTML;
      const tempElement = document.createElement('textarea');
      tempElement.innerHTML = codeContent;
      return tempElement.value;
    }
  } catch (error) {
    console.error("LeetHub: Error fetching CodeChef plain text solution:", error);
  }
  return "";
}
