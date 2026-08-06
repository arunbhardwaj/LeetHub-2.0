import { getBrowser } from "./leetcode/util.js";

let action = false;
let api = getBrowser();

// Redirect elements to onboarding
const welcomeUrl = api.runtime.getURL('welcome.html');
$('#welcome_URL').attr('href', welcomeUrl);
$('#lc_setup_btn, #gfg_setup_btn, #cc_setup_btn').on('click', (e) => {
  e.preventDefault();
  api.tabs.create({ url: welcomeUrl });
});

$('#authenticate').on('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

// Stats reset flow variables
let platformToReset = null;

const showResetConfirmation = (platform) => {
  platformToReset = platform;
  let name = 'LeetCode';
  if (platform === 'gfg') {
    name = 'GeeksforGeeks';
  } else if (platform === 'codechef') {
    name = 'CodeChef';
  }
  $('#reset_msg').text(`Are you sure you want to delete your ${name} stats?`);
  $('#reset_confirmation').show();
};

$('#lc_reset').on('click', () => showResetConfirmation('leetcode'));
$('#gfg_reset').on('click', () => showResetConfirmation('gfg'));
$('#cc_reset').on('click', () => showResetConfirmation('codechef'));

$('#reset_no').on('click', () => {
  $('#reset_confirmation').hide();
  platformToReset = null;
});

$('#reset_yes').on('click', () => {
  if (platformToReset === 'leetcode') {
    api.storage.local.set({ stats: null }, () => {
      $('#lc_solved').text(0);
      $('#lc_easy').text(0);
      $('#lc_medium').text(0);
      $('#lc_hard').text(0);
    });
  } else if (platformToReset === 'gfg') {
    api.storage.local.set({ gfg_stats: null }, () => {
      $('#gfg_solved').text(0);
      $('#gfg_easy').text(0);
      $('#gfg_medium').text(0);
      $('#gfg_hard').text(0);
    });
  } else if (platformToReset === 'codechef') {
    api.storage.local.set({ codechef_stats: null }, () => {
      $('#cc_solved').text(0);
      $('#cc_easy').text(0);
      $('#cc_medium').text(0);
      $('#cc_hard').text(0);
    });
  }
  $('#reset_confirmation').hide();
  platformToReset = null;
});

// Load auth and stats
api.storage.local.get('leethub_token', data => {
  const token = data.leethub_token;
  if (token === null || token === undefined) {
    action = true;
    $('#auth_mode').show();
  } else {
    // Validate token with GitHub
    const AUTHENTICATION_URL = 'https://api.github.com/user';
    const xhr = new XMLHttpRequest();
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          $('#authorized_mode').show();
          
          api.storage.local.get(['leethub_hook', 'gfg_hook', 'codechef_hook', 'stats', 'gfg_stats', 'codechef_stats'], storage => {
            // LeetCode Panel setup
            if (storage.leethub_hook) {
              const lcStats = storage.stats;
              $('#lc_solved').text(lcStats?.solved ?? 0);
              $('#lc_easy').text(lcStats?.easy ?? 0);
              $('#lc_medium').text(lcStats?.medium ?? 0);
              $('#lc_hard').text(lcStats?.hard ?? 0);
              
              $('#lc_repo_link').html(
                `<a target="blank" style="color: cadetblue !important;" href="https://github.com/${storage.leethub_hook}">${storage.leethub_hook}</a>`
              );
              $('#lc_linked_view').show();
            } else {
              $('#lc_unlinked_view').show();
            }

            // GFG Panel setup
            if (storage.gfg_hook) {
              const gfgStats = storage.gfg_stats;
              $('#gfg_solved').text(gfgStats?.solved ?? 0);
              $('#gfg_easy').text(gfgStats?.easy ?? 0);
              $('#gfg_medium').text(gfgStats?.medium ?? 0);
              $('#gfg_hard').text(gfgStats?.hard ?? 0);
              
              $('#gfg_repo_link').html(
                `<a target="blank" style="color: cadetblue !important;" href="https://github.com/${storage.gfg_hook}">${storage.gfg_hook}</a>`
              );
              $('#gfg_linked_view').show();
            } else {
              $('#gfg_unlinked_view').show();
            }

            // CodeChef Panel setup
            if (storage.codechef_hook) {
              const ccStats = storage.codechef_stats;
              $('#cc_solved').text(ccStats?.solved ?? 0);
              $('#cc_easy').text(ccStats?.easy ?? 0);
              $('#cc_medium').text(ccStats?.medium ?? 0);
              $('#cc_hard').text(ccStats?.hard ?? 0);
              
              $('#cc_repo_link').html(
                `<a target="blank" style="color: cadetblue !important;" href="https://github.com/${storage.codechef_hook}">${storage.codechef_hook}</a>`
              );
              $('#cc_linked_view').show();
            } else {
              $('#cc_unlinked_view').show();
            }
          });

        } else if (xhr.status === 401) {
          // Bad oAuth, reset and ask to re-authenticate
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
