import { getBrowser } from './leetcode/util.js';

const api = getBrowser();

const getCreateErrorString = (statusCode, name) => {
  const errorStrings = {
    304: `Error creating ${name} - Unable to modify repository. Try again later!`,
    400: `Error creating ${name} - Bad POST request, make sure you're not overriding any existing scripts`,
    401: `Error creating ${name} - Unauthorized access to repo. Try again later!`,
    403: `Error creating ${name} - Forbidden access to repository. Try again later!`,
    422: `Error creating ${name} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).`,
  };
  return errorStrings[statusCode] || `Error creating ${name} (${statusCode})`;
};

const getLinkErrorString = (statusCode, name) => {
  const errorStrings = {
    301: `Error linking <a target="blank" href="https://github.com/${name}">${name}</a>. <br> This repository has been moved permanently.`,
    403: `Error linking <a target="blank" href="https://github.com/${name}">${name}</a>. <br> Forbidden action. Check repository permissions.`,
    404: `Error linking <a target="blank" href="https://github.com/${name}">${name}</a>. <br> Resource not found. Check repository name.`,
  };
  return errorStrings[statusCode] || `Error linking ${name} (${statusCode})`;
};

/* Sync's local storage with persistent stats and returns the pulled stats. */
const syncStats = async (platform) => {
  const hookKey = platform === 'leetcode' ? 'leethub_hook' : (platform === 'gfg' ? 'gfg_hook' : 'codechef_hook');
  const statsKey = platform === 'leetcode' ? 'stats' : (platform === 'gfg' ? 'gfg_stats' : 'codechef_stats');
  const syncKey = platform === 'leetcode' ? 'sync_stats' : (platform === 'gfg' ? 'gfg_sync_stats' : 'codechef_sync_stats');

  let storage = await api.storage.local.get([
    'leethub_token',
    hookKey,
    syncKey,
    statsKey,
  ]);

  const token = storage.leethub_token;
  const hook = storage[hookKey];
  const syncVal = storage[syncKey];

  if (syncVal === false) {
    console.log(`Persistent stats for ${platform} already synced!`);
    return;
  }

  const URL = `https://api.github.com/repos/${hook}/contents/stats.json`;

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  let resp = await fetch(URL, options);
  if (!resp.ok && resp.status == 404) {
    await api.storage.local.set({ [syncKey]: false });
    console.log(`No stats found for ${platform}; starting fresh`);
    return {};
  }
  let data = await resp.json();
  let pStatsJson = decodeURIComponent(escape(atob(data.content)));
  let pStats = await JSON.parse(pStatsJson);

  const statsObj = platform === 'leetcode' ? pStats.leetcode : (platform === 'gfg' ? pStats.gfg : pStats.codechef);

  await api.storage.local.set({ [statsKey]: statsObj, [syncKey]: false });
  console.log(`Successfully synced local stats with GitHub stats for ${platform}`);

  return { stats: statsObj };
};

const createRepo = async (token, name, platform) => {
  const hookKey = platform === 'leetcode' ? 'leethub_hook' : (platform === 'gfg' ? 'gfg_hook' : 'codechef_hook');
  const statsKey = platform === 'leetcode' ? 'stats' : (platform === 'gfg' ? 'gfg_stats' : 'codechef_stats');
  
  const prefix = platform === 'leetcode' ? 'lc' : (platform === 'gfg' ? 'gfg' : 'cc');
  const errId = `#${prefix}_error`;
  const successId = `#${prefix}_success`;
  const modeId = `#${prefix}_hook_mode`;
  const commitId = `#${prefix}_commit_mode`;
  const repoUrlId = `#${prefix}_repo_url`;
  const solvedId = `#${prefix}_p_solved`;
  const easyId = `#${prefix}_p_solved_easy`;
  const medId = `#${prefix}_p_solved_medium`;
  const hardId = `#${prefix}_p_solved_hard`;

  const AUTHENTICATION_URL = 'https://api.github.com/user/repos';
  let data = {
    name,
    private: true,
    auto_init: true,
    description: platform === 'leetcode' 
      ? 'A collection of LeetCode questions to ace the coding interview! - Created using LeetHub v2'
      : (platform === 'gfg' ? 'A collection of GeeksforGeeks questions - Created using LeetHub v2' : 'A collection of CodeChef questions - Created using LeetHub v2'),
  };

  const options = {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
    body: JSON.stringify(data),
  };

  let res = await fetch(AUTHENTICATION_URL, options);
  if (!res.ok) {
    $(successId).hide();
    $(errId).text(getCreateErrorString(res.status, name));
    $(errId).show();
    return;
  }
  res = await res.json();

  await api.storage.local.set({ mode_type: 'commit', [hookKey]: res.full_name });
  await api.storage.local.remove(statsKey);

  $(errId).hide();
  $(successId).html(
    `Successfully created <a target="_blank" href="${res.html_url}">${name}</a>. Start solving!`
  );
  $(successId).show();

  $(modeId).hide();
  $(repoUrlId).html(`<a target="blank" href="${res.html_url}">${res.full_name}</a>`);
  $(solvedId).text(0);
  $(easyId).text(0);
  $(medId).text(0);
  $(hardId).text(0);
  $(commitId).show();
};

const linkRepo = (token, name, platform) => {
  const hookKey = platform === 'leetcode' ? 'leethub_hook' : (platform === 'gfg' ? 'gfg_hook' : 'codechef_hook');
  const statsKey = platform === 'leetcode' ? 'stats' : (platform === 'gfg' ? 'gfg_stats' : 'codechef_stats');
  const syncKey = platform === 'leetcode' ? 'sync_stats' : (platform === 'gfg' ? 'gfg_sync_stats' : 'codechef_sync_stats');
  
  const prefix = platform === 'leetcode' ? 'lc' : (platform === 'gfg' ? 'gfg' : 'cc');
  const errId = `#${prefix}_error`;
  const successId = `#${prefix}_success`;
  const modeId = `#${prefix}_hook_mode`;
  const commitId = `#${prefix}_commit_mode`;
  const repoUrlId = `#${prefix}_repo_url`;
  const solvedId = `#${prefix}_p_solved`;
  const easyId = `#${prefix}_p_solved_easy`;
  const medId = `#${prefix}_p_solved_medium`;
  const hardId = `#${prefix}_p_solved_hard`;

  const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState !== 4) {
      return;
    }
    if (xhr.status !== 200) {
      $(successId).hide();
      $(errId).html(getLinkErrorString(xhr.status, name));
      $(errId).show();

      api.storage.local.set({ [hookKey]: null }, () => {
        console.log(`Error linking ${name} to LeetHub`);
      });

      $(modeId).show();
      $(commitId).hide();
      return;
    }

    const res = JSON.parse(xhr.responseText);
    api.storage.local.set(
      { mode_type: 'commit', [hookKey]: res.full_name },
      () => {
        $(errId).hide();
        $(successId).html(
          `Successfully linked <a target="_blank" href="${res.html_url}">${name}</a>!`
        );
        $(successId).show();
      }
    );

    api.storage.local.get(syncKey).then(data => {
      if (data?.[syncKey]) {
        return syncStats(platform);
      } else {
        return api.storage.local.get(statsKey).then(res2 => ({ stats: res2?.[statsKey] }));
      }
    }).then(data => {
      const stats = data?.stats;
      $(solvedId).text(stats?.solved ?? 0);
      $(easyId).text(stats?.easy ?? 0);
      $(medId).text(stats?.medium ?? 0);
      $(hardId).text(stats?.hard ?? 0);
    });

    $(repoUrlId).html(`<a target="blank" href="${res.html_url}">${res.full_name}</a>`);
    $(modeId).hide();
    $(commitId).show();
  });

  xhr.open('GET', AUTHENTICATION_URL, true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
  xhr.send();
};

const unlinkRepo = (platform) => {
  const hookKey = platform === 'leetcode' ? 'leethub_hook' : (platform === 'gfg' ? 'gfg_hook' : 'codechef_hook');
  const statsKey = platform === 'leetcode' ? 'stats' : (platform === 'gfg' ? 'gfg_stats' : 'codechef_stats');
  const syncKey = platform === 'leetcode' ? 'sync_stats' : (platform === 'gfg' ? 'gfg_sync_stats' : 'codechef_sync_stats');
  
  const prefix = platform === 'leetcode' ? 'lc' : (platform === 'gfg' ? 'gfg' : 'cc');
  const modeId = `#${prefix}_hook_mode`;
  const commitId = `#${prefix}_commit_mode`;
  const successId = `#${prefix}_success`;

  api.storage.local.set(
    { [hookKey]: null, [syncKey]: true, [statsKey]: null },
    () => {
      console.log(`Unlinked ${platform} repo`);
    }
  );

  $(successId).text('Successfully unlinked repo.');
  $(successId).show();
  $(modeId).show();
  $(commitId).hide();
};

// Dropdowns and Hooking
$('#lc_type').on('change', function () {
  $('#lc_hook_button').attr('disabled', !this.value);
});
$('#gfg_type').on('change', function () {
  $('#gfg_hook_button').attr('disabled', !this.value);
});
$('#cc_type').on('change', function () {
  $('#cc_hook_button').attr('disabled', !this.value);
});

const handleHookClick = (platform) => {
  const prefix = platform === 'leetcode' ? 'lc' : (platform === 'gfg' ? 'gfg' : 'cc');
  const typeId = `#${prefix}_type`;
  const nameId = `#${prefix}_name`;
  const errId = `#${prefix}_error`;
  const successId = `#${prefix}_success`;

  const typeVal = $(typeId).val();
  const nameVal = $(nameId).val().trim();

  if (!typeVal) {
    $(errId).text('No option selected.').show();
  } else if (!nameVal) {
    $(errId).text('No repository name added.').show();
    $(nameId).focus();
  } else {
    $(errId).hide();
    $(successId).text('Linking repository... Please wait.').show();

    api.storage.local.get('leethub_token', data => {
      const token = data.leethub_token;
      if (!token) {
        $(errId).text('Authorization error. Please authenticate LeetHub first.').show();
        $(successId).hide();
      } else if (typeVal === 'new') {
        createRepo(token, nameVal, platform);
      } else {
        api.storage.local.get('leethub_username', data2 => {
          const username = data2.leethub_username;
          if (!username) {
            $(errId).text('Username not found in storage. Try re-authenticating.').show();
            $(successId).hide();
          } else {
            linkRepo(token, `${username}/${nameVal}`, platform);
          }
        });
      }
    });
  }
};

$('#lc_hook_button').on('click', () => handleHookClick('leetcode'));
$('#gfg_hook_button').on('click', () => handleHookClick('gfg'));
$('#cc_hook_button').on('click', () => handleHookClick('codechef'));

$('#lc_unlink').on('click', () => unlinkRepo('leetcode'));
$('#gfg_unlink').on('click', () => unlinkRepo('gfg'));
$('#cc_unlink').on('click', () => unlinkRepo('codechef'));

// Initialization logic
api.storage.local.get(['leethub_token', 'leethub_hook', 'gfg_hook', 'codechef_hook'], (data) => {
  const token = data.leethub_token;
  if (!token) {
    $('#lc_error, #gfg_error, #cc_error').text('Please click the extension icon to authenticate with GitHub first.').show();
    return;
  }

  if (data.leethub_hook) {
    linkRepo(token, data.leethub_hook, 'leetcode');
  } else {
    $('#lc_hook_mode').show();
  }

  if (data.gfg_hook) {
    linkRepo(token, data.gfg_hook, 'gfg');
  } else {
    $('#gfg_hook_mode').show();
  }

  if (data.codechef_hook) {
    linkRepo(token, data.codechef_hook, 'codechef');
  } else {
    $('#cc_hook_mode').show();
  }
});
