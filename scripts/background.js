let api = isChrome() ? chrome : isFirefox() ? browser : undefined;

// const ONE_HOUR_MS = 60 * 60 * 1000;

api.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    // Allow persistent stats to sync on repo link
    api.storage.local.set({ sync_stats: true});
  }
});

api.runtime.onMessage.addListener(handleMessage);

function handleMessage(request, sender, sendResponse) {
  if (request && request.closeWebPage === true && request.isSuccess === true)
  {
    api.storage.local.set({ leethub_username: request.username });
    api.storage.local.set({ leethub_token: request.token });
    api.storage.local.set({ pipe_leethub: false }, () => {
      console.log('Closed pipe.');
    });

    api.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      api.tabs.remove(tab.id);
    });

    /* Go to onboarding UX */
    const urlOnboarding = api.runtime.getURL('welcome.html');
    api.tabs.create({ url: urlOnboarding, active: true }); // creates new tab
  } 
  else if (request && request.closeWebPage === true && request.isSuccess === false)
  {
    alert('Something went wrong while trying to authenticate your profile!');
    api.tabs.query({ active: true, lastFocusedWindow: true }, function (tabs) {
      var tab = tabs[0];
      api.tabs.remove(tab.id);
    });
  } 
  else if (request.type === 'LEETCODE_SUBMISSION')
  {
    // Each request gets its own listener, so removing it never removes another request's listener
    const onSubmissionUrl = details => {
      const match = details.url.match(/\/submissions\/(\d+)/);
      if (!match) {
        // e.g. the submissions list page (/submissions/) without an id; keep waiting
        return;
      }
      const submissionId = match[1];
      sendResponse({ submissionId });
      api.webNavigation.onHistoryStateUpdated.removeListener(onSubmissionUrl);
    };
    api.webNavigation.onHistoryStateUpdated.addListener(onSubmissionUrl, {
      // Conditions within one filter are ANDed; separate filters in the array are ORed
      url: [{ hostSuffix: 'leetcode.com', pathContains: 'submissions' }],
    });
  }
  return true;
}

function isChrome() {
  return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
}

function isFirefox() {
  return typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
}
