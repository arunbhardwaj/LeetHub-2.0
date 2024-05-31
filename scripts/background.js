function handleMessage(request, sender, sendResponse) {
  if ( request && request.closeWebPage === true && request.isSuccess === true ) {
    /* Set username */
    chrome.storage.local.set({ leethub_username: request.username });

    /* Set token */
    chrome.storage.local.set({ leethub_token: request.token });

    /* Close pipe */
    chrome.storage.local.set({ pipe_leethub: false }, () => {
      console.log('Closed pipe.');
    });

    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function(tabs) {
      var tab = tabs[0];
      chrome.tabs.remove(tab.id)
    });

    /* Go to onboarding for UX */
    const urlOnboarding = chrome.runtime.getURL('welcome.html');
    chrome.tabs.create({ url: urlOnboarding, active: true }); // creates new tab
  } else if ( request && request.closeWebPage === true && request.isSuccess === false ) {
    alert(
      'Something went wrong while trying to authenticate your profile!',
    );
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, function(tabs) {
        var tab = tabs[0];
        chrome.tabs.remove(tab.id)
    });
  } else if ( request.type === 'LEETCODE_SUBMISSION') {
    chrome.webNavigation.onHistoryStateUpdated.addListener(e = function (details) {
      let submissionId = (details.url.includes('submissions')) ? details.url.match(/\/submissions\/(\d+)\//)[1] : null;
      sendResponse({submissionId})
      chrome.webNavigation.onHistoryStateUpdated.removeListener(e)
    }, {url: [{hostSuffix: 'leetcode.com'}]})
  }
  return true
}

chrome.runtime.onMessage.addListener(handleMessage);
