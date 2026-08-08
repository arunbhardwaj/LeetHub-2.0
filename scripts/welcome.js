import { getBrowser } from './core/browser.js';
import {
  createRepository,
  getStoredSetup,
  GitHubSetupError,
  listWritableRepositories,
  normalizeRepositoryName,
  saveRepository,
  validateGitHubConnection,
  validateRepository,
} from './core/githubSetup.js';

const api = getBrowser();
let setup = null;

const errorMessages = {
  authentication_failed: 'GitHub authentication failed. Connect GitHub again.',
  not_connected: 'Connect GitHub before selecting a repository.',
  invalid_repository: 'Enter a valid repository in owner/name format.',
  repository_forbidden: 'GitHub denied access to this repository.',
  repository_not_found: 'Repository not found. Check the owner and name.',
  repository_not_writable: 'Your GitHub account does not have write access to this repository.',
  network_failure: 'Could not reach GitHub. Check your network and try again.',
  github_request_failed: 'GitHub could not complete the request. Try again.',
};

function showMessage(type, message) {
  $('#error, #success').hide();
  $(`#${type}`).text(message).show();
}

function showRepositoryForm() {
  $('#repository_setup').show();
  $('#ready_state').hide();
}

function showReady(repository) {
  $('#selected_repository').text(repository);
  $('#selected_repository_link').attr('href', `https://github.com/${repository}`);
  $('#repository_setup').hide();
  $('#ready_state').show();
}

function renderStats(stats) {
  $('#p_solved').text(stats?.solved ?? 0);
  $('#p_solved_easy').text(stats?.easy ?? 0);
  $('#p_solved_medium').text(stats?.medium ?? 0);
  $('#p_solved_hard').text(stats?.hard ?? 0);
}

function messageFor(error) {
  return errorMessages[error?.code] ?? errorMessages.github_request_failed;
}

async function loadRepositories() {
  $('#repository_list').prop('disabled', true).html('<option value="">Loading…</option>');
  try {
    const repositories = await listWritableRepositories(setup.token);
    $('#repository_list')
      .empty()
      .append($('<option>').val('').text('Choose a writable repository'));
    for (const repository of repositories) {
      $('#repository_list').append(
        $('<option>').val(repository.fullName).text(repository.fullName)
      );
    }
    $('#repository_list').prop('disabled', false);
  } catch (error) {
    $('#repository_list')
      .html('<option value="">Repositories unavailable</option>')
      .prop('disabled', false);
    showMessage('error', messageFor(error));
  }
}

async function selectRepository() {
  const selected = $('#repository_list').val();
  const entered = $('#repository_name').val().trim();
  const requested = entered || selected;
  if (!requested) {
    showMessage('error', 'Choose a repository or enter owner/name.');
    return;
  }

  $('#save_repository').prop('disabled', true).text('Validating…');
  try {
    const fullName = normalizeRepositoryName(requested, setup.username);
    const repository = await validateRepository(setup.token, fullName);
    await saveRepository(api, repository);
    setup.repository = repository.fullName;
    setup.mode = 'commit';
    showMessage('success', `${repository.fullName} is selected and ready for GFG sync.`);
    showReady(repository.fullName);
  } catch (error) {
    showMessage('error', messageFor(error));
  } finally {
    $('#save_repository').prop('disabled', false).text('Use Repository');
  }
}

async function createNewRepository() {
  const name = $('#new_repository_name').val().trim();
  $('#create_repository').prop('disabled', true).text('Creating…');
  try {
    const repository = await createRepository(setup.token, name);
    await saveRepository(api, repository);
    setup.repository = repository.fullName;
    setup.mode = 'commit';
    showMessage('success', `${repository.fullName} was created and is ready for GFG sync.`);
    showReady(repository.fullName);
  } catch (error) {
    showMessage('error', messageFor(error));
  } finally {
    $('#create_repository').prop('disabled', false).text('Create Private Repository');
  }
}

$('#connect_github').on('click', () => oAuth2.begin());
$('#refresh_repositories').on('click', loadRepositories);
$('#save_repository').on('click', selectRepository);
$('#create_repository').on('click', createNewRepository);
$('#change_repository').on('click', () => {
  showRepositoryForm();
  loadRepositories();
});
$('#repository_list').on('change', function () {
  if (this.value) $('#repository_name').val('');
});

async function initialize() {
  setup = await getStoredSetup(api);
  renderStats(setup.stats);
  $('#connection_status').text('Connecting');

  if (!setup.token) {
    const status =
      setup.authStatus === 'connecting'
        ? 'Connecting'
        : setup.authStatus === 'failed'
        ? 'Authentication Failed'
        : 'Not Connected';
    $('#connection_status').text(status);
    $('#connect_required').show();
    $('#repository_content').hide();
    return;
  }

  try {
    const user = await validateGitHubConnection(setup.token);
    setup.username = user.login;
    await api.storage.local.set({
      leethub_username: user.login,
      github_auth_status: 'connected',
    });
    $('#connection_status').text('Connected');
    $('#connect_required').hide();
    $('#repository_content').show();
    if (setup.repository && setup.mode === 'commit') {
      showReady(setup.repository);
    } else {
      showRepositoryForm();
      await loadRepositories();
    }
  } catch (error) {
    const failed = error instanceof GitHubSetupError && error.code === 'authentication_failed';
    $('#connection_status').text(failed ? 'Authentication Failed' : 'Not Connected');
    showMessage('error', messageFor(error));
    $('#connect_required').show();
    $('#repository_content').hide();
    await api.storage.local.set({ github_auth_status: failed ? 'failed' : 'disconnected' });
  }
}

initialize();
