const api = isFirefox() ? browser : isChrome() ? chrome : undefined;

api.runtime.onMessage.addListener(handleMessage);

function handleMessage(request, sender) {
  if (request && request.closeWebPage === true && request.isSuccess === true) {
    void api.storage.local
      .set({
        leethub_username: request.username,
        leethub_token: request.token,
        pipe_leethub: false,
        github_auth_status: 'connected',
      })
      .then(() => {
        closeAuthenticationTab(sender);
        const urlOnboarding = api.runtime.getURL('welcome.html');
        return api.tabs.create({ url: urlOnboarding, active: true });
      });
  } else if (request && request.closeWebPage === true && request.isSuccess === false) {
    void api.storage.local
      .set({ pipe_leethub: false, github_auth_status: 'failed' })
      .then(() => closeAuthenticationTab(sender));
  }
  return true;
}

function closeAuthenticationTab(sender) {
  if (sender?.tab?.id !== undefined) {
    void api.tabs.remove(sender.tab.id);
  }
}

function isChrome() {
  return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
}

function isFirefox() {
  return typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
}
