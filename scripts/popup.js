import { getBrowser } from "./leetcode/util.js";

let action = false;

let api = getBrowser()

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
  $('#reset_yes').off('click').on('click', () => {
    api.storage.local.set({ stats: null });
    $('#p_solved').text(0);
    $('#p_solved_easy').text(0);
    $('#p_solved_medium').text(0);
    $('#p_solved_hard').text(0);
    $('#reset_confirmation').hide()
  })
  $('#reset_no').off('click').on('click', () => {
    $('#reset_confirmation').hide()
  })
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
                $('#p_solved').text(stats?.solved ?? 0);
                $('#p_solved_easy').text(stats?.easy ?? 0);
                $('#p_solved_medium').text(stats?.medium ?? 0);
                $('#p_solved_hard').text(stats?.hard ?? 0);
                const leethubHook = data3?.leethub_hook;
                if (leethubHook) {
                  $('#repo_url').html(
                    `<a target="blank" style="color: cadetblue !important; font-size:0.8em;" href="https://github.com/${leethubHook}">${leethubHook}</a>`
                  );
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

/* Gemini API Key Management */
api.storage.local.get('gemini_api_key', data => {
  if (data.gemini_api_key) {
    const masked = '••••••••' + data.gemini_api_key.slice(-4);
    $('#gemini_status').text(`✅ API key saved (${masked})`);
  }
});

$('#save_gemini_key').on('click', () => {
  const key = $('#gemini_api_key').val().trim();
  if (!key) {
    $('#gemini_status').css('color', '#d9534f').text('❌ Please enter a valid API key.');
    return;
  }
  api.storage.local.set({ gemini_api_key: key }, () => {
    const masked = '••••••••' + key.slice(-4);
    $('#gemini_api_key').val('');
    $('#gemini_status').css('color', '#5cb85c').text(`✅ API key saved (${masked})`);
  });
});

$('#sync_backlog').on('click', async () => {
  const $status = $('#sync_status');
  const $btn = $('#sync_backlog');
  
  $btn.addClass('disabled');
  $status.text('Fetching your profile data...');

  try {
    const { leethub_username } = await api.storage.local.get('leethub_username');
    if (!leethub_username) {
      $status.text('Error: Username not found. Please submit one problem normally first.');
      $btn.removeClass('disabled');
      return;
    }

    $status.text('Fetching past submissions (Target: 156+)...');
    
    const query = {
      query: `query recentAcSubmissions($username: String!, $limit: Int!) {
        recentAcSubmissionList(username: $username, limit: $limit) {
          id
          titleSlug
        }
      }`,
      variables: { username: leethub_username, limit: 200 } 
    };

    const res = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(query)
    });
    
    const data = await res.json();
    const submissions = data.data.recentAcSubmissionList;

    if (!submissions || submissions.length === 0) {
      $status.text('No previous submissions found.');
      $btn.removeClass('disabled');
      return;
    }

    for (let i = 0; i < submissions.length; i++) {
      $status.text(`Syncing problem ${i + 1} of ${submissions.length}... Please keep popup open.`);
      
      await api.runtime.sendMessage({
        type: 'LEETCODE_SUBMISSION',
        submissionId: submissions[i].id
      });

      // Wait 5 seconds between requests
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    $status.text('Backlog sync successfully completed!');
  } catch (err) {
    console.error(err);
    $status.text('An error occurred during sync.');
  } finally {
    $btn.removeClass('disabled');
  }
});
