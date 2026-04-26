import { getBrowser } from './leetcode/util.js';

let action = false;

let api = getBrowser();

const setRepoLink = hook => {
  const repoUrl = `https://github.com/${hook}`;
  const link = document.createElement('a');
  link.target = '_blank';
  link.rel = 'noopener';
  link.style.color = 'cadetblue';
  link.style.fontSize = '0.8em';
  link.href = repoUrl;
  link.textContent = hook;

  const repoElement = document.getElementById('repo_url');
  repoElement.textContent = '';
  repoElement.appendChild(link);
};

const emptyStats = () => ({
  shas: {},
  solved: 0,
  easy: 0,
  medium: 0,
  hard: 0,
});

const encode = data => btoa(unescape(encodeURIComponent(data)));

const storageGet = keys => new Promise(resolve => api.storage.local.get(keys, resolve));
const storageSet = data => new Promise(resolve => api.storage.local.set(data, resolve));

async function resetGitHubStats(token, hook) {
  if (!token || !hook) {
    return;
  }

  const url = `https://api.github.com/repos/${hook}/contents/stats.json`;
  const headers = {
    Authorization: `token ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };

  const existing = await fetch(url, { headers });
  if (existing.status === 404) {
    return;
  }
  if (!existing.ok) {
    throw new Error(`Unable to fetch GitHub stats: ${existing.status}`);
  }

  const { sha } = await existing.json();
  const resetPayload = {
    message: 'Reset stats',
    content: encode(JSON.stringify({ leetcode: emptyStats() })),
    sha,
  };

  const updated = await fetch(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(resetPayload),
  });

  if (!updated.ok) {
    throw new Error(`Unable to reset GitHub stats: ${updated.status}`);
  }
}

function renderStats(stats) {
  $('#p_solved').text(stats?.solved ?? 0);
  $('#p_solved_easy').text(stats?.easy ?? 0);
  $('#p_solved_medium').text(stats?.medium ?? 0);
  $('#p_solved_hard').text(stats?.hard ?? 0);
}

$('#authenticate').on('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

/* Get URL for welcome page */
$('#welcome_URL').attr('href', api.runtime.getURL('welcome.html'));
$('#hook_URL').attr('href', api.runtime.getURL('welcome.html'));
$('#reset_stats').on('click', () => {
  $('#reset_confirmation').show();
  $('#reset_yes')
    .off('click')
    .on('click', async () => {
      const stats = emptyStats();
      $('#reset_yes').attr('disabled', true);
      try {
        const { leethub_token, leethub_hook } = await storageGet(['leethub_token', 'leethub_hook']);
        await resetGitHubStats(leethub_token, leethub_hook);
        await storageSet({ stats, sync_stats: false });
        renderStats(stats);
      } catch (err) {
        console.error(err);
      } finally {
        $('#reset_yes').attr('disabled', false);
        $('#reset_confirmation').hide();
      }
    });
  $('#reset_no')
    .off('click')
    .on('click', () => {
      $('#reset_confirmation').hide();
    });
});

api.storage.local.get('leethub_token', data => {
  const token = data.leethub_token;
  if (token === null || token === undefined) {
    action = true;
    $('#auth_mode').show();
  } else {
    // To validate user, load user object from GitHub.
    const AUTHENTICATION_URL = 'https://api.github.com/user';

    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          /* Show MAIN FEATURES */
          api.storage.local.get('mode_type', data2 => {
            if (data2 && data2.mode_type === 'commit') {
              $('#commit_mode').show();
              /* Get problem stats and repo link */
              api.storage.local.get(['stats', 'leethub_hook'], data3 => {
                const stats = data3?.stats;
                renderStats(stats);
                const leethubHook = data3?.leethub_hook;
                if (leethubHook) {
                  setRepoLink(leethubHook);
                }
              });
            } else {
              $('#hook_mode').show();
            }
          });
        } else if (xhr.status === 401) {
          // bad oAuth
          // reset token and redirect to authorization process again!
          api.storage.local.set({ leethub_token: null }, () => {
            console.log('BAD oAuth!!! Redirecting back to oAuth process');
            action = true;
            $('#auth_mode').show();
          });
        }
      }
    });
    xhr.open('GET', AUTHENTICATION_URL, true);
    xhr.setRequestHeader('Authorization', `token ${token}`);
    xhr.send();
  }
});
