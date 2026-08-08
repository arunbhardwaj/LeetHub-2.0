function isChrome() {
  return typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined';
}

function isFirefox() {
  return typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined';
}

function getBrowser() {
  if (isFirefox()) {
    return browser;
  }

  if (isChrome()) {
    return chrome;
  }

  throw new Error('BrowserNotSupported');
}

export { getBrowser, isChrome, isFirefox };
