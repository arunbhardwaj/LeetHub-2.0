import { getBrowser } from "./leetcode/util.js";
import { getRevisionData } from "./tracker/storage.js";
import { prioritizeProblems } from "./tracker/prioritizer.js";

let action = false;

let api = getBrowser()

$('#authenticate').on('click', () => {
  if (action) {
    oAuth2.begin();
  }
});

$('#open_tracker').on('click', () => {
  api.tabs.create({ url: api.runtime.getURL('tracker.html'), active: true });
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
              updateTrackerWidget();
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

async function updateTrackerWidget() {
  try {
    const revData = await getRevisionData(api);
    const problems = revData.problems || {};
    const prioResult = prioritizeProblems(problems);
    const dueCount = prioResult.dueCount;

    if (dueCount > 0) {
      $('#tracker_due_badge').text(`${dueCount} Due`).show();
    } else {
      $('#tracker_due_badge').hide();
    }

    const top = prioResult.rankedQueue[0];
    if (top) {
      const dueText = top.isDue ? '🚨 Due for review' : `Next in ${top.targetIntervalDays - (top.elapsedDays || 0)}d`;
      $('#tracker_quick_info').html(`
        <strong style="color:#222;">${top.frontendId ? `#${top.frontendId} ` : ''}${top.title}</strong>
        <div style="font-size: 11px; color: #666; margin-top: 3px;">${dueText} • Priority: ${top.priorityLevel}</div>
      `);
    } else {
      $('#tracker_quick_info').text('Solve problems on LeetCode to populate revision schedules.');
    }
  } catch (err) {
    console.error('[LeetHub Tracker Popup]', err);
    $('#tracker_quick_info').text('Click below to open Smart Revision Tracker.');
  }
}

