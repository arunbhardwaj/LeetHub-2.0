/* GeeksforGeeks Integration for LeetHub v2 */

// Languages supported by GeeksforGeeks
const gfgLanguages = {
  Python3: '.py',
  'C++': '.cpp',
  Java: '.java',
  Javascript: '.js',
  C: '.c',
  Go: '.go',
  Rust: '.rs',
  Kotlin: '.kt',
  Swift: '.swift',
  TypeScript: '.ts',
};

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
  try {
    const ele = document.getElementsByClassName('divider text')[0]?.innerText;
    if (!ele) return null;
    
    const lang = ele.split('(')[0].trim();
    if (lang.length > 0 && gfgLanguages[lang]) {
      return gfgLanguages[lang];
    }
  } catch (e) {
    console.error('Error finding GFG language:', e);
  }
  return null;
}

function findTitle() {
  try {
    const ele = document.querySelector('[class^="problems_header_content__title"] > h3')?.innerText;
    return ele || '';
  } catch (e) {
    console.error('Error finding GFG title:', e);
    return '';
  }
}

function findDifficulty() {
  try {
    const ele = document.querySelectorAll('[class^="problems_header_description"]')[0]?.children[0]?.innerText;
    if (ele != null) {
      if (ele.trim() === 'Basic' || ele.trim() === 'School') {
        return 'Easy';
      }
      return ele.trim();
    }
  } catch (e) {
    console.error('Error finding GFG difficulty:', e);
  }
  return 'Unknown';
}

function getProblemStatement() {
  try {
    const ele = document.querySelector('[class^="problems_problem_content"]');
    return ele ? ele.outerHTML : '';
  } catch (e) {
    console.error('Error getting problem statement:', e);
    return '';
  }
}

function getCode() {
  try {
    const scriptContent = `
      var editor = ace.edit("ace-editor");
      var editorContent = editor.getValue();
      var para = document.createElement("pre");
      para.innerText += editorContent;
      para.setAttribute("id", "codeDataLeetHub");
      document.body.appendChild(para);
    `;

    var script = document.createElement('script');
    script.id = 'tmpScript';
    script.appendChild(document.createTextNode(scriptContent));
    (document.body || document.head || document.documentElement).appendChild(script);
    
    const text = document.getElementById('codeDataLeetHub')?.innerText || '';
    
    // Cleanup
    const nodeDeletionScript = `
      var elem = document.getElementById("codeDataLeetHub");
      if (elem) elem.remove();
    `;
    var cleanupScript = document.createElement('script');
    cleanupScript.id = 'tmpScript2';
    cleanupScript.appendChild(document.createTextNode(nodeDeletionScript));
    (document.body || document.head || document.documentElement).appendChild(cleanupScript);

    return text;
  } catch (e) {
    console.error('Error getting code:', e);
    return '';
  }
}

function getGfgStats() {
  try {
    const stats = document.querySelector('[class^="problems_header_description"]');
    if (stats) {
      const accuracy = stats.querySelector('[class^="problems_accuracy"]');
      return accuracy ? accuracy.innerText : '';
    }
  } catch (e) {
    console.error('Error getting GFG stats:', e);
  }
  return '';
}

// Upload function similar to LeetCode
async function uploadToGitHub(content, problemName, filename, message, difficulty) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['leethub_token', 'leethub_hook', 'stats'], async (data) => {
      const { leethub_token: token, leethub_hook: hook, stats } = data;
      
      if (!token || !hook) {
        reject(new Error('Not authenticated or no repo linked'));
        return;
      }

      // Determine path based on difficulty
      const diffFolder = difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase() : '';
      const path = diffFolder ? `${diffFolder}/${problemName}/${filename}` : `${problemName}/${filename}`;
      
      // Get existing SHA if file exists
      let sha = '';
      if (stats?.shas?.[problemName]?.[filename]) {
        sha = stats.shas[problemName][filename];
      }

      const URL = `https://api.github.com/repos/${hook}/contents/${path}`;
      
      const options = {
        method: 'PUT',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
        },
        body: JSON.stringify({
          message,
          content,
          sha,
        }),
      };

      try {
        const res = await fetch(URL, options);
        if (!res.ok) {
          throw new Error(`GitHub API error: ${res.status}`);
        }
        
        const body = await res.json();
        
        // Update stats
        if (!stats.shas) stats.shas = {};
        if (!stats.shas[problemName]) stats.shas[problemName] = {};
        stats.shas[problemName][filename] = body.content.sha;
        stats.shas[problemName].difficulty = difficulty?.toLowerCase() || 'unknown';
        
        chrome.storage.local.set({ stats });
        
        console.log(`Successfully committed ${path} to github`);
        resolve(body.content.sha);
      } catch (err) {
        console.error('Upload failed:', err);
        reject(err);
      }
    });
  });
}

// Increment stats
function incrementGfgStats(difficulty) {
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

// Check if problem already completed
function isGfgCompleted(problemName) {
  return new Promise((resolve) => {
    chrome.storage.local.get('stats', (data) => {
      const stats = data.stats;
      if (!stats?.shas?.[problemName]) {
        resolve(false);
        return;
      }
      
      for (let file of Object.keys(stats.shas[problemName])) {
        if (file.includes(problemName)) {
          resolve(true);
          return;
        }
      }
      resolve(false);
    });
  });
}

// Main loader
const gfgLoader = setInterval(() => {
  if (window.location.href.includes('practice.geeksforgeeks.org/problems')) {
    const submitBtn = document.evaluate(
      ".//button[text()='Submit']",
      document.body,
      null,
      XPathResult.ANY_TYPE,
      null
    ).iterateNext();

    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        START_MONITOR = true;
        const submission = setInterval(async () => {
          try {
            const output = document.querySelector('[class^="problems_content"]')?.innerText || '';
            
            if (output.includes('Problem Solved Successfully') && START_MONITOR) {
              START_MONITOR = false;
              clearInterval(gfgLoader);
              clearInterval(submission);
              
              // Get data
              const title = findTitle().trim();
              const difficulty = findDifficulty();
              const problemStatement = getProblemStatement();
              const code = getCode();
              const language = findGfgLanguage();
              
              if (!title || !language) {
                console.error('Could not find title or language');
                return;
              }
              
              // Check if already completed
              const alreadyCompleted = await isGfgCompleted(title);
              if (alreadyCompleted) {
                console.log(`GFG problem ${title} already completed, skipping...`);
                return;
              }
              
              // Format data
              const probName = `${title} - GFG`;
              const fileName = toKebabCase(title + language);
              
              // Create README
              const readmeContent = `# ${title}\n## ${difficulty}\n${problemStatement}`;
              await uploadToGitHub(
                btoa(unescape(encodeURIComponent(readmeContent))),
                probName,
                'README.md',
                README_MSG,
                difficulty
              );
              
              // Upload code
              if (code) {
                await uploadToGitHub(
                  btoa(unescape(encodeURIComponent(code))),
                  probName,
                  fileName,
                  SUBMIT_MSG,
                  difficulty
                );
                
                // Increment stats
                await incrementGfgStats(difficulty);
                
                console.log(`Successfully uploaded GFG solution: ${title}`);
              }
            } else if (output.includes('Compilation Error')) {
              clearInterval(submission);
            }
          } catch (err) {
            console.error('GFG submission error:', err);
          }
        }, 1000);
      });
    }
  }
}, 1000);
