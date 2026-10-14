/* CodeChef Integration for LeetHub v2 */

const ccLanguages = {
  'Python 3': '.py',
  'Python 3 (pypy)': '.py',
  'Python 2': '.py',
  'C++14': '.cpp',
  'C++': '.cpp',
  'Java 8': '.java',
  'Java': '.java',
  'C': '.c',
  'Go': '.go',
  'Rust': '.rs',
  'JavaScript': '.js',
  'Ruby': '.rb',
  'Scala': '.scala',
  'Kotlin': '.kt',
};

const CC_COMMIT_MSG = 'Added CodeChef solution - LeetHub';
const CC_README_MSG = 'Create README - LeetHub';

const toKebabCaseCC = (string) => {
  return string
    .replace(/[^a-zA-Z0-9\. ]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

function getCcTitle() {
  try {
    const title = document.querySelector('.problem-statement h2')?.innerText ||
                  document.querySelector('[class*="problem-name"]')?.innerText ||
                  document.querySelector('h1[class*="title"]')?.innerText;
    return title ? title.trim() : '';
  } catch (e) {
    console.error('Error finding CC title:', e);
    return '';
  }
}

function getCcProblemCode() {
  try {
    const code = document.querySelector('[class*="problem-code"]')?.innerText ||
                 document.querySelector('.code')?.innerText ||
                 window.location.pathname.split('/').pop();
    return code ? code.trim() : '';
  } catch (e) {
    console.error('Error finding CC problem code:', e);
    return '';
  }
}

function getCcDifficulty() {
  try {
    const diff = document.querySelector('[class*="difficulty"]')?.innerText ||
                 document.querySelector('.rating')?.innerText;
    if (!diff) return 'Unknown';
    
    const d = diff.toLowerCase().trim();
    if (d.includes('easy') || d.includes('school') || d.includes('beginner')) {
      return 'Easy';
    } else if (d.includes('medium') || d.includes('intermediate')) {
      return 'Medium';
    } else if (d.includes('hard') || d.includes('advanced')) {
      return 'Hard';
    }
    return 'Medium';
  } catch (e) {
    console.error('Error finding CC difficulty:', e);
    return 'Unknown';
  }
}

function getCcLanguage() {
  try {
    const langSelect = document.querySelector('select[name="language"]') ||
                       document.querySelector('.language-select');
    if (langSelect) {
      const lang = langSelect.value || langSelect.innerText;
      if (ccLanguages[lang]) return ccLanguages[lang];
      
      for (const [key, ext] of Object.entries(ccLanguages)) {
        if (lang.toLowerCase().includes(key.toLowerCase())) {
          return ext;
        }
      }
    }
  } catch (e) {
    console.error('Error finding CC language:', e);
  }
  return null;
}

function getCcCode() {
  try {
    const editor = document.querySelector('.CodeMirror')?.CodeMirror?.getValue() ||
                   document.querySelector('textarea[name="source"]')?.value ||
                   document.querySelector('[class*="code"] textarea')?.value;
    return editor || '';
  } catch (e) {
    console.error('Error getting CC code:', e);
    return '';
  }
}

function getCcProblemStatement() {
  try {
    const statement = document.querySelector('.problem-statement')?.innerHTML ||
                      document.querySelector('[class*="problem"]')?.innerHTML;
    return statement || '';
  } catch (e) {
    console.error('Error getting CC problem statement:', e);
    return '';
  }
}

async function uploadToGitHubCC(content, problemName, filename, message, difficulty) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['leethub_token', 'leethub_hook', 'stats'], async (data) => {
      const { leethub_token: token, leethub_hook: hook, stats } = data;
      
      if (!token || !hook) {
        reject(new Error('Not authenticated'));
        return;
      }

      const diffFolder = difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase() : '';
      const path = diffFolder ? `${diffFolder}/${problemName}/${filename}` : `${problemName}/${filename}`;
      
      let sha = stats?.shas?.[problemName]?.[filename] || '';

      const URL = `https://api.github.com/repos/${hook}/contents/${path}`;
      
      const options = {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({ message, content, sha }),
      };

      try {
        const res = await fetch(URL, options);
        if (!res.ok) throw new Error(`GitHub API error: ${res.status}`);
        
        const body = await res.json();
        
        if (!stats.shas) stats.shas = {};
        if (!stats.shas[problemName]) stats.shas[problemName] = {};
        stats.shas[problemName][filename] = body.content.sha;
        stats.shas[problemName].difficulty = difficulty?.toLowerCase() || 'unknown';
        
        chrome.storage.local.set({ stats });
        console.log(`Successfully committed ${path} to github`);
        resolve(body.content.sha);
      } catch (err) {
        reject(err);
      }
    });
  });
}

function incrementCcStats(difficulty) {
  return new Promise((resolve) => {
    chrome.storage.local.get('stats', (data) => {
      let stats = data.stats || { solved: 0, easy: 0, medium: 0, hard: 0, shas: {} };
      stats.solved += 1;
      if (difficulty === 'Easy') stats.easy += 1;
      else if (difficulty === 'Medium') stats.medium += 1;
      else if (difficulty === 'Hard') stats.hard += 1;
      chrome.storage.local.set({ stats });
      resolve(stats);
    });
  });
}

function isCcCompleted(problemName) {
  return new Promise((resolve) => {
    chrome.storage.local.get('stats', (data) => {
      const stats = data.stats;
      if (!stats?.shas?.[problemName]) { resolve(false); return; }
      for (let file of Object.keys(stats.shas[problemName])) {
        if (file.includes(problemName)) { resolve(true); return; }
      }
      resolve(false);
    });
  });
}

const ccLoader = setInterval(async () => {
  if (window.location.href.includes('codechef.com')) {
    const submitBtn = document.querySelector('button[type="submit"]') ||
                      document.querySelector('[class*="submit"]') ||
                      document.querySelector('.btn-submit');
    
    if (submitBtn && !submitBtn._leethubListener) {
      submitBtn._leethubListener = true;
      submitBtn.addEventListener('click', () => {
        let monitorInterval = setInterval(async () => {
          try {
            const verdict = document.querySelector('[class*="success"]') ||
                           document.querySelector('[class*="accepted"]');
            
            if (verdict) {
              clearInterval(monitorInterval);
              
              const title = getCcTitle();
              const problemCode = getCcProblemCode();
              const difficulty = getCcDifficulty();
              const language = getCcLanguage();
              const code = getCcCode();
              
              if (!title || !language || !code) {
                console.error('Could not find CC title, language, or code');
                return;
              }
              
              const alreadyCompleted = await isCcCompleted(`${problemCode}-${toKebabCaseCC(title)}`);
              if (alreadyCompleted) {
                console.log(`CC problem already completed, skipping...`);
                return;
              }
              
              const probName = `${problemCode}-${toKebabCaseCC(title)} - CC`;
              const fileName = toKebabCaseCC(title + language);
              
              const readmeContent = `# ${problemCode}: ${title}\n## ${difficulty}\n${getCcProblemStatement()}`;
              await uploadToGitHubCC(
                btoa(unescape(encodeURIComponent(readmeContent))),
                probName, 'README.md', CC_README_MSG, difficulty
              );
              
              await uploadToGitHubCC(
                btoa(unescape(encodeURIComponent(code))),
                probName, fileName, CC_COMMIT_MSG, difficulty
              );
              
              await incrementCcStats(difficulty);
              console.log(`Successfully uploaded CC solution: ${title}`);
            }
          } catch (err) {
            console.error('CC submission monitoring error:', err);
          }
        }, 2000);
        
        setTimeout(() => clearInterval(monitorInterval), 300000);
      });
    }
  }
}, 1000);
