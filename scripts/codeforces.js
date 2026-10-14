/* Codeforces Integration for LeetHub v2 */

const cfLanguages = {
  'GNU G++17': '.cpp',
  'GNU G++14': '.cpp',
  'GNU G++': '.cpp',
  'MS C++': '.cpp',
  'Python 3': '.py',
  'Python 2': '.py',
  'Java 11': '.java',
  'Java 8': '.java',
  'C++': '.cpp',
  'C': '.c',
  'C#': '.cs',
  'Go': '.go',
  'Rust': '.rs',
  'Kotlin': '.kt',
  'Ruby': '.rb',
  'JavaScript': '.js',
  'Node.js': '.js',
};

const CF_COMMIT_MSG = 'Added Codeforces solution - LeetHub';
const CF_README_MSG = 'Create README - LeetHub';

const toKebabCaseCF = (string) => {
  return string
    .replace(/[^a-zA-Z0-9\. ]/g, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
};

function getCfTitle() {
  try {
    const title = document.querySelector('.problem-statement .title')?.innerText ||
                  document.querySelector('[class*="problemheader"] h2')?.innerText ||
                  document.querySelector('.header .title')?.innerText;
    return title ? title.replace(/^\d+[A-Z]?\s*/, '').trim() : '';
  } catch (e) {
    console.error('Error finding CF title:', e);
    return '';
  }
}

function getCfProblemId() {
  try {
    const match = window.location.href.match(/\/problemset\/problem\/(\d+)\/(\w+)/) ||
                  window.location.href.match(/\/contest\/\d+\/problem\/(\w+)/);
    if (match) {
      return match[1] ? `${match[1]}${match[2] || ''}` : match[0];
    }
    return '';
  } catch (e) {
    console.error('Error finding CF problem ID:', e);
    return '';
  }
}

function getCfDifficulty() {
  try {
    const diff = document.querySelector('.problem-statement .difficulty')?.innerText ||
                 document.querySelector('[class*="difficulty"]')?.innerText;
    if (!diff) return 'Unknown';
    
    const d = diff.toLowerCase().trim();
    if (d.includes('easy') || d.includes('800') || d.includes('900') || d.includes('1000') || d.includes('1100') || d.includes('1200')) {
      return 'Easy';
    } else if (d.includes('medium') || d.includes('1300') || d.includes('1400') || d.includes('1500') || d.includes('1600') || d.includes('1700')) {
      return 'Medium';
    } else if (d.includes('hard') || d.includes('1800') || d.includes('1900') || d.includes('2000') || d.includes('2100') || d.includes('2200') || d.includes('2300') || d.includes('2400') || d.includes('2500') || d.includes('2600') || d.includes('2700') || d.includes('2800') || d.includes('2900') || d.includes('3000') || d.includes('3100') || d.includes('3200') || d.includes('3300') || d.includes('3400') || d.includes('3500')) {
      return 'Hard';
    }
    return 'Medium';
  } catch (e) {
    console.error('Error finding CF difficulty:', e);
    return 'Unknown';
  }
}

function getCfLanguage() {
  try {
    const langSelect = document.querySelector('select[name="language"]') ||
                       document.querySelector('.language-select') ||
                       document.querySelector('[class*="lang"]');
    if (langSelect) {
      const lang = langSelect.value || langSelect.innerText;
      if (cfLanguages[lang]) return cfLanguages[lang];
      
      for (const [key, ext] of Object.entries(cfLanguages)) {
        if (lang.toLowerCase().includes(key.toLowerCase())) {
          return ext;
        }
      }
    }
  } catch (e) {
    console.error('Error finding CF language:', e);
  }
  return null;
}

function getCfCode() {
  try {
    const editor = document.querySelector('.CodeMirror')?.CodeMirror?.getValue() ||
                   document.querySelector('textarea[name="source"]')?.value ||
                   document.querySelector('[class*="code"] textarea')?.value;
    return editor || '';
  } catch (e) {
    console.error('Error getting CF code:', e);
    return '';
  }
}

function getCfProblemStatement() {
  try {
    const statement = document.querySelector('.problem-statement')?.innerHTML || '';
    return statement;
  } catch (e) {
    console.error('Error getting CF problem statement:', e);
    return '';
  }
}

async function uploadToGitHubCF(content, problemName, filename, message, difficulty) {
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

function incrementCfStats(difficulty) {
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

function isCfCompleted(problemName) {
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

const cfLoader = setInterval(async () => {
  if (window.location.href.includes('codeforces.com')) {
    const submitBtn = document.querySelector('.submit') ||
                      document.querySelector('[class*="submit"]') ||
                      document.querySelector('input[type="submit"]');
    
    if (submitBtn && !submitBtn._leethubListener) {
      submitBtn._leethubListener = true;
      submitBtn.addEventListener('click', () => {
        let monitorInterval = setInterval(async () => {
          try {
            const verdict = document.querySelector('.verdict-accepted') ||
                           document.querySelector('[class*="accepted"]');
            
            if (verdict) {
              clearInterval(monitorInterval);
              
              const title = getCfTitle();
              const problemId = getCfProblemId();
              const difficulty = getCfDifficulty();
              const language = getCfLanguage();
              const code = getCfCode();
              
              if (!title || !language || !code) {
                console.error('Could not find CF title, language, or code');
                return;
              }
              
              const alreadyCompleted = await isCfCompleted(`${problemId}-${toKebabCaseCF(title)}`);
              if (alreadyCompleted) {
                console.log(`CF problem already completed, skipping...`);
                return;
              }
              
              const probName = `${problemId}-${toKebabCaseCF(title)} - CF`;
              const fileName = toKebabCaseCF(title + language);
              
              const readmeContent = `# ${problemId}. ${title}\n## ${difficulty}\n${getCfProblemStatement()}`;
              await uploadToGitHubCF(
                btoa(unescape(encodeURIComponent(readmeContent))),
                probName, 'README.md', CF_README_MSG, difficulty
              );
              
              await uploadToGitHubCF(
                btoa(unescape(encodeURIComponent(code))),
                probName, fileName, CF_COMMIT_MSG, difficulty
              );
              
              await incrementCfStats(difficulty);
              console.log(`Successfully uploaded CF solution: ${title}`);
            }
          } catch (err) {
            console.error('CF submission monitoring error:', err);
          }
        }, 2000);
        
        setTimeout(() => clearInterval(monitorInterval), 300000);
      });
    }
  }
}, 1000);
