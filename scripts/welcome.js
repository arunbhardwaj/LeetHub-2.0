import { getBrowser } from './leetcode/util.js';

const api = getBrowser();

const option = () => {
  return $('#type').val();
};

const repositoryName = () => {
  return $('#name').val().trim();
};

const createRepoDescription =
  'A collection of LeetCode questions to ace the coding interview! - Created using [LeetHub v2](https://github.com/arunbhardwaj/LeetHub-2.0)';

/* Sync's local storage with persistent stats and returns the pulled stats. Currently only syncs when we install, or unlink then relink */
const syncStats = async () => {
  let { leethub_hook, leethub_token, sync_stats, stats } = await api.storage.local.get([
    'leethub_token',
    'leethub_hook',
    'sync_stats',
    'stats',
  ]);

  if (sync_stats === false) {
    console.log('Persistent stats already synced!');
    return;
  }

  const URL = `https://api.github.com/repos/${leethub_hook}/contents/stats.json`;

  let options = {
    method: 'GET',
    headers: {
      Authorization: `token ${leethub_token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  };

  let resp = await fetch(URL, options);
  if (!resp.ok && resp.status == 404) {
    await api.storage.local.set({ sync_stats: false });
    console.log('No stats found; starting fresh');
    return {};
  }
  let data = await resp.json();
  let pStatsJson = decodeURIComponent(escape(atob(data.content)));
  let pStats = await JSON.parse(pStatsJson);

  api.storage.local.set({ stats: pStats.leetcode, sync_stats: false }, () =>
    console.log(`Successfully synced local stats with GitHub stats`)
  );

  // emulate the nested return obj of api.storage.local.get('stats')
  return { stats: pStats.leetcode };
};

const getCreateErrorString = (statusCode, name) => {
  /* Status codes for creating of repo */
  const errorStrings = {
    304: `Error creating ${name} - Unable to modify repository. Try again later!`,
    400: `Error creating ${name} - Bad POST request, make sure you're not overriding any existing scripts`,
    401: `Error creating ${name} - Unauthorized access to repo. Try again later!`,
    403: `Error creating ${name} - Forbidden access to repository. Try again later!`,
    422: `Error creating ${name} - Unprocessable Entity. Repository may have already been created. Try Linking instead (select 2nd option).`,
  };
  return errorStrings[statusCode];
};

const handleRepoCreateError = (statusCode, name) => {
  $('#success').hide();
  $('#error').text(getCreateErrorString(statusCode, name));
  $('#error').show();
};

const createRepo = async (token, name) => {
  const AUTHENTICATION_URL = 'https://api.github.com/user/repos';
  let data = {
    name,
    private: false,
    auto_init: true,
    description: createRepoDescription,
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
    return handleRepoCreateError(res.status, name);
  }
  res = await res.json();

  /* Set Repo Hook, and set mode type to commit */
  api.storage.local.set({ mode_type: 'commit', leethub_hook: res.full_name });
  await api.storage.local.remove('stats');
  $('#error').hide();
  $('#success').html(
    `Successfully created <a target="blank" href="${res.html_url}">${name}</a>. Start <a href="http://leetcode.com">LeetCoding</a>!`
  );
  $('#success').show();
  $('#unlink').show();
  /* Show new layout */
  document.getElementById('hook_mode').style.display = 'none';
  document.getElementById('commit_mode').style.display = 'inherit';
};

const getLinkErrorString = (statusCode, name) => {
  /* Status codes for linking repo */
  const errorStrings = {
    301: `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to LeetHub. <br> This repository has been moved permenantly. Try creating a new one.`,
    403: `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to LeetHub. <br> Forbidden action. Please make sure you have the right access to this repository.`,
    404: `Error linking <a target="blank" href="${`https://github.com/${name}`}">${name}</a> to LeetHub. <br> Resource not found. Make sure you enter the right repository name.`,
  };
  return errorStrings[statusCode];
};
/* Status codes for linking of repo */
const handleLinkRepoError = (statusCode, name) => {
  $('#success').hide();
  $('#error').html(getLinkErrorString(statusCode, name));
  $('#error').show();
  $('#unlink').show();
};

/* 
    Method for linking hook with an existing repository 
    Steps:
    1. Check if existing repository exists and the user has write access to it.
    2. Link Hook to it (chrome Storage).
*/
const linkRepo = (token, name) => {
  const AUTHENTICATION_URL = `https://api.github.com/repos/${name}`;

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState !== 4) {
      return;
    }
    if (xhr.status !== 200) {
      // BUG FIX
      // unable to gain access to repo in commit mode. Must switch to hook mode.
      /* Set mode type to hook and Repo Hook to NONE */
      handleLinkRepoError(xhr.status, name);
      api.storage.local.set({ mode_type: 'hook', leethub_hook: null }, () => {
        console.log(`Error linking ${name} to LeetHub`);
        console.log('Defaulted repo hook to NONE');
      });

      /* Hide accordingly */
      document.getElementById('hook_mode').style.display = 'inherit';
      document.getElementById('commit_mode').style.display = 'none';
      return;
    }

    const res = JSON.parse(xhr.responseText);
    api.storage.local.set(
      { mode_type: 'commit', repo: res.html_url, leethub_hook: res.full_name },
      () => {
        $('#error').hide();
        $('#success').html(
          `Successfully linked <a target="blank" href="${res.html_url}">${name}</a> to LeetHub. Start <a href="http://leetcode.com">LeetCoding</a> now!`
        );
        $('#success').show();
        $('#unlink').show();
        console.log('Successfully set new repo hook');
      }
    );
    /* Get Persistent Stats or Create new stats */
    api.storage.local
      .get('sync_stats')
      .then(data => (data?.sync_stats ? syncStats() : api.storage.local.get('stats')))
      .then(data => {
        /* Get problems solved count */
        const stats = data?.stats;
        $('#p_solved').text(stats?.solved ?? 0);
        $('#p_solved_easy').text(stats?.easy ?? 0);
        $('#p_solved_medium').text(stats?.medium ?? 0);
        $('#p_solved_hard').text(stats?.hard ?? 0);
      });

    /* Hide accordingly */
    document.getElementById('hook_mode').style.display = 'none';
    document.getElementById('commit_mode').style.display = 'inherit';
  });

  xhr.open('GET', AUTHENTICATION_URL, true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.setRequestHeader('Accept', 'application/vnd.github.v3+json');
  xhr.send();
};

const unlinkRepo = () => {
  /* Reset mode type to hook, stats to null */
  api.storage.local.set(
    { mode_type: 'hook', leethub_hook: null, sync_stats: true, stats: null },
    () => {
      console.log(`Unlinked repo`);
      console.log('Cleared local stats');
    }
  );

  /* Hide accordingly */
  document.getElementById('hook_mode').style.display = 'inherit';
  document.getElementById('commit_mode').style.display = 'none';
};

/* Check for value of select tag, Get Started disabled by default */

$('#type').on('change', function () {
  const valueSelected = this.value;
  if (valueSelected) {
    $('#hook_button').attr('disabled', false);
  } else {
    $('#hook_button').attr('disabled', true);
  }
});

$('#hook_button').on('click', () => {
  /* on click should generate: 1) option 2) repository name */
  if (!option()) {
    $('#error').text(
      'No option selected - Pick an option from dropdown menu below that best suits you!'
    );
    $('#error').show();
  } else if (!repositoryName()) {
    $('#error').text('No repository name added - Enter the name of your repository!');
    $('#name').focus();
    $('#error').show();
  } else {
    $('#error').hide();
    $('#success').text('Attempting to create Hook... Please wait.');
    $('#success').show();

    /* 
      Perform processing
      - step 1: Check if current stage === hook.
      - step 2: store repo name as repoName in chrome storage.
      - step 3: if (1), POST request to repoName (iff option = create new repo) ; else display error message.
      - step 4: if proceed from 3, hide hook_mode and display commit_mode (show stats e.g: files pushed/questions-solved/leaderboard)
    */
    api.storage.local.get('leethub_token', data => {
      const token = data.leethub_token;
      if (token === null || token === undefined) {
        /* Not authorized yet. */
        $('#error').text(
          'Authorization error - Grant LeetHub access to your GitHub account to continue (launch extension to proceed)'
        );
        $('#error').show();
        $('#success').hide();
      } else if (option() === 'new') {
        createRepo(token, repositoryName());
      } else {
        api.storage.local.get('leethub_username', data2 => {
          const username = data2.leethub_username;
          if (!username) {
            /* Improper authorization. */
            $('#error').text(
              'Improper Authorization error - Grant LeetHub access to your GitHub account to continue (launch extension to proceed)'
            );
            $('#error').show();
            $('#success').hide();
          } else {
            linkRepo(token, `${username}/${repositoryName()}`, false);
          }
        });
      }
    });
  }
});

$('#unlink a').on('click', () => {
  unlinkRepo();
  $('#unlink').hide();
  $('#success').text('Successfully unlinked your current git repo. Please create/link a new hook.');
});

/* Detect mode type */
api.storage.local.get('mode_type', data => {
  const mode = data.mode_type;

  if (mode && mode === 'commit') {
    /* Check if still access to repo */
    api.storage.local.get('leethub_token', data2 => {
      const token = data2.leethub_token;
      if (token === null || token === undefined) {
        /* Not authorized yet. */
        $('#error').text(
          'Authorization error - Grant LeetHub access to your GitHub account to continue (click LeetHub extension on the top right to proceed)'
        );
        $('#error').show();
        $('#success').hide();
        /* Hide accordingly */
        document.getElementById('hook_mode').style.display = 'inherit';
        document.getElementById('commit_mode').style.display = 'none';
      } else {
        /* Get access to repo */
        api.storage.local.get('leethub_hook', repoName => {
          const hook = repoName.leethub_hook;
          if (!hook) {
            /* Not authorized yet. */
            $('#error').text(
              'Improper Authorization error - Grant LeetHub access to your GitHub account to continue (click LeetHub extension on the top right to proceed)'
            );
            $('#error').show();
            $('#success').hide();
            /* Hide accordingly */
            document.getElementById('hook_mode').style.display = 'inherit';
            document.getElementById('commit_mode').style.display = 'none';
          } else {
            /* Username exists, at least in storage. Confirm this */
            linkRepo(token, hook);
          }
        });
      }
    });

    document.getElementById('hook_mode').style.display = 'none';
    document.getElementById('commit_mode').style.display = 'inherit';
  } else {
    document.getElementById('hook_mode').style.display = 'inherit';
    document.getElementById('commit_mode').style.display = 'none';
  }
});
