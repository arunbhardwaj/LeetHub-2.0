import { getBrowser } from './core/browser.js';
import { getStoredSetup, GitHubSetupError, validateGitHubConnection } from './core/githubSetup.js';
import { resetGfgStats, STORAGE_KEYS } from './core/storage.js';

const api = getBrowser();

function displayLanguage(language) {
  const value = String(language ?? '').trim();
  if (!value) return 'Unknown';
  if (value === 'cpp') return 'C++';
  if (value === 'csharp') return 'C#';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function renderStats(stats) {
  $('#p_solved').text(stats?.solved ?? 0);
  $('#p_solved_easy').text(stats?.easy ?? 0);
  $('#p_solved_medium').text(stats?.medium ?? 0);
  $('#p_solved_hard').text(stats?.hard ?? 0);
}

function renderLastSync(lastSync) {
  if (!lastSync) {
    $('#last_sync_empty').show();
    $('#last_sync_details').hide();
    return;
  }
  $('#last_sync_empty').hide();
  $('#last_sync_details').show();
  $('#last_sync_title').text(lastSync.title ?? lastSync.slug ?? 'Unknown problem');
  $('#last_sync_language')
    .text(lastSync.language ? displayLanguage(lastSync.language) : '')
    .toggle(Boolean(lastSync.language));
  const successful = lastSync.status !== 'failed';
  $('#last_sync_result')
    .text(successful ? 'Success' : 'Failed')
    .toggleClass('sync-success', successful)
    .toggleClass('sync-failed', !successful);
  $('#last_sync_message')
    .text(successful ? '' : lastSync.message ?? 'GitHub sync failed')
    .toggle(!successful);
}

function showConnection(status, detail = '') {
  $('#connection_status').text(status);
  $('#connection_detail').text(detail).toggle(Boolean(detail));
}

function showConnectAction(label = 'Connect GitHub') {
  $('#authenticate').text(label).show();
  $('#repository_action, #ready_state').hide();
}

function showRepositoryAction() {
  $('#authenticate, #ready_state').hide();
  $('#repository_action').show();
}

function showReady(setup) {
  $('#authenticate, #repository_action').hide();
  $('#ready_state').show();
  $('#sync_status').text('Ready');
  const repositoryLink = $('<a>')
    .attr({
      href: `https://github.com/${setup.repository}`,
      target: '_blank',
      rel: 'noopener noreferrer',
    })
    .text(setup.repository);
  $('#repo_url').empty().append(repositoryLink);
}

$('#authenticate').on('click', () => oAuth2.begin());
$('#repository_action, #change_repository').on('click', () => {
  api.tabs.create({ url: api.runtime.getURL('welcome.html'), active: true });
});
$('#settings_URL').attr('href', api.runtime.getURL('welcome.html'));

$('#reset_stats').on('click', () => $('#reset_confirmation').show());
$('#reset_no').on('click', () => $('#reset_confirmation').hide());
$('#reset_yes').on('click', async () => {
  const stats = await resetGfgStats();
  renderStats(stats);
  renderLastSync(null);
  $('#reset_confirmation').hide();
});

async function initialize() {
  showConnection('Connecting');
  const [setup, lastSyncData] = await Promise.all([
    getStoredSetup(api),
    api.storage.local.get([STORAGE_KEYS.LAST_SYNC_STATUS, STORAGE_KEYS.LAST_SUCCESSFUL_SYNC]),
  ]);
  renderStats(setup.stats);
  const latest =
    lastSyncData[STORAGE_KEYS.LAST_SYNC_STATUS] ??
    (lastSyncData[STORAGE_KEYS.LAST_SUCCESSFUL_SYNC]
      ? { ...lastSyncData[STORAGE_KEYS.LAST_SUCCESSFUL_SYNC], status: 'success' }
      : null);
  renderLastSync(latest);

  if (!setup.token) {
    if (setup.authStatus === 'connecting') {
      showConnection('Connecting', 'Complete authorization in the GitHub tab.');
      showConnectAction('Restart Connection');
    } else if (setup.authStatus === 'failed') {
      showConnection('Authentication Failed', 'GitHub authorization did not complete. Try again.');
      showConnectAction('Connect Again');
    } else {
      showConnection('Not Connected', 'Connect GitHub to start syncing.');
      showConnectAction();
    }
    return;
  }

  try {
    const user = await validateGitHubConnection(setup.token);
    await api.storage.local.set({
      [STORAGE_KEYS.USERNAME]: user.login,
      github_auth_status: 'connected',
    });
    showConnection('Connected');
    if (setup.mode === 'commit' && setup.repository) {
      showReady(setup);
    } else {
      $('#sync_status').text('Setup Required');
      showRepositoryAction();
    }
  } catch (error) {
    const authFailed = error instanceof GitHubSetupError && error.code === 'authentication_failed';
    showConnection(
      authFailed ? 'Authentication Failed' : 'Not Connected',
      authFailed
        ? 'GitHub rejected the saved authorization. Connect again.'
        : 'Could not reach GitHub. Check your network and try again.'
    );
    await api.storage.local.set({ github_auth_status: authFailed ? 'failed' : 'disconnected' });
    showConnectAction('Connect Again');
  }
}

initialize();
