const api =
  typeof chrome !== 'undefined' && chrome.runtime
    ? chrome
    : typeof browser !== 'undefined' && browser.runtime
    ? browser
    : null;

const CLIENT_ID = '0114dd35b156d4729fac';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const SCOPES = ['repo'];

const statusEl = document.getElementById('auth_status');
const codeEl = document.getElementById('auth_code');
const hintEl = document.getElementById('auth_hint');
const verifyLink = document.getElementById('verify_link');
const welcomeLink = document.getElementById('welcome_link');

function setStatus(message) {
  statusEl.textContent = message;
}

function storageSet(data) {
  return new Promise(resolve => api.storage.local.set(data, resolve));
}

async function postForm(url, data) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams(data).toString(),
  });

  if (!res.ok) {
    throw new Error(`GitHub request failed: ${res.status}`);
  }

  return res.json();
}

async function getGitHubUser(token) {
  const res = await fetch(USER_URL, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub user request failed: ${res.status}`);
  }

  return res.json();
}

async function pollForToken(deviceCode, intervalSeconds, expiresInSeconds) {
  const startedAt = Date.now();
  let interval = intervalSeconds;

  while (Date.now() - startedAt < expiresInSeconds * 1000) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    const response = await postForm(ACCESS_TOKEN_URL, {
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    if (response.access_token) {
      return response.access_token;
    }

    if (response.error === 'authorization_pending') {
      continue;
    }

    if (response.error === 'slow_down') {
      interval += 5;
      continue;
    }

    throw new Error(response.error_description || response.error || 'GitHub authorization failed');
  }

  throw new Error('GitHub authorization expired. Please start again.');
}

async function startAuth() {
  if (!api) {
    throw new Error('Browser extensions are not supported in this browser.');
  }

  verifyLink.hidden = true;
  welcomeLink.href = api.runtime.getURL('welcome.html');

  const device = await postForm(DEVICE_CODE_URL, {
    client_id: CLIENT_ID,
    scope: SCOPES.join(' '),
  });

  codeEl.textContent = device.user_code;
  verifyLink.href = device.verification_uri;
  verifyLink.hidden = false;
  hintEl.textContent = 'Enter this code on GitHub. This page will finish setup automatically.';
  setStatus('Waiting for GitHub approval...');

  const token = await pollForToken(device.device_code, device.interval || 5, device.expires_in);
  const user = await getGitHubUser(token);

  await storageSet({
    leethub_token: token,
    leethub_username: user.login,
    pipe_leethub: false,
  });

  setStatus('GitHub connected.');
  hintEl.textContent = 'You can continue to repository setup.';
  verifyLink.hidden = true;
  welcomeLink.hidden = false;
}

startAuth().catch(err => {
  setStatus('GitHub connection failed.');
  hintEl.textContent = err.message;
  verifyLink.hidden = true;
});
