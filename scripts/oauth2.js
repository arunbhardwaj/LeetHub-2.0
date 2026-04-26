// eslint-disable-next-line no-unused-vars
const oAuth2 = {
  begin() {
    const api =
      typeof chrome !== 'undefined' && chrome.runtime
        ? chrome
        : typeof browser !== 'undefined' && browser.runtime
        ? browser
        : null;
    if (!api) return;

    api.tabs.create({ url: api.runtime.getURL('auth.html'), active: true });
  },
};
