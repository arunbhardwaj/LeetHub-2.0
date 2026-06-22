import { getBrowser } from "./leetcode/util.js";

/* global oAuth2 */

let action = false;

let api = getBrowser()

/* OAuth Quick Setup button */
$('#auth_oauth').on('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

/* Toggle PAT input section */
$('#auth_pat_toggle').on('click', () => {
  $('#auth_selector').hide();
  $('#pat_section').show();
  $('#pat_input').focus();
});

/* Back from PAT section */
$('#pat_back').on('click', () => {
  $('#pat_section').hide();
  $('#pat_error').hide();
  $('#pat_success').hide();
  $('#pat_input').val('');
  $('#auth_selector').show();
});

/* PAT submission & validation */
$('#pat_submit').on('click', () => {
  const token = $('#pat_input').val().trim();
  if (!token) {
    $('#pat_error').text('Please enter a token.').show();
    $('#pat_success').hide();
    return;
  }

  $('#pat_error').hide();
  $('#pat_success').text('Validating...').show();
  $('#pat_submit').prop('disabled', true);

  const xhr = new XMLHttpRequest();
  xhr.addEventListener('readystatechange', function () {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        const username = JSON.parse(xhr.responseText).login;
        /* Store token, username, and auth mode */
        api.storage.local.set({
          leethub_token: token,
          leethub_username: username,
          auth_mode: 'pat',
          pipe_leethub: false,
        }, () => {
          $('#pat_success').text(`✅ Connected as ${username}`).show();
          $('#pat_error').hide();
          $('#pat_submit').prop('disabled', false);
          /* Redirect to welcome page after short delay */
          setTimeout(() => {
            const welcomeUrl = api.runtime.getURL('welcome.html');
            api.tabs.create({ url: welcomeUrl, active: true });
          }, 1000);
        });
      } else if (xhr.status === 401) {
        $('#pat_error').text('Invalid token. Please check and try again.').show();
        $('#pat_success').hide();
        $('#pat_submit').prop('disabled', false);
      } else if (xhr.status === 403) {
        $('#pat_error').text('Token lacks required permissions. Ensure Contents: Read & Write is enabled.').show();
        $('#pat_success').hide();
        $('#pat_submit').prop('disabled', false);
      } else {
        $('#pat_error').text(`GitHub API error (${xhr.status}). Try again later.`).show();
        $('#pat_success').hide();
        $('#pat_submit').prop('disabled', false);
      }
    }
  });
  xhr.open('GET', 'https://api.github.com/user', true);
  xhr.setRequestHeader('Authorization', `token ${token}`);
  xhr.send();
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
              /* Show auth mode badge */
              api.storage.local.get('auth_mode', data4 => {
                const mode = data4?.auth_mode;
                if (mode === 'pat') {
                  $('#auth_mode_badge')
                    .html('🔒 Selective Repos (Token)')
                    .show();
                } else {
                  $('#auth_mode_badge')
                    .html('🔑 All Repos (OAuth)')
                    .show();
                }
              });
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
