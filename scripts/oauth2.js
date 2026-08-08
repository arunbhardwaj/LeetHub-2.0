// eslint-disable-next-line no-unused-vars
const oAuth2 = {
  /**
   * Initialize
   */
  init() {
    this.KEY = 'leethub_token';
    this.ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
    this.AUTHORIZATION_URL = 'https://github.com/login/oauth/authorize';
    this.CLIENT_ID = '0114dd35b156d4729fac';
    this.CLIENT_SECRET = 'cfc3301d9745530bf1b31e92528ad9c31fd3f995';
    this.REDIRECT_URL = 'https://github.com/'; // for example, https://github.com
    this.SCOPES = ['repo'];
  },

  /**
   * Begin
   */
  async begin() {
    this.init(); // secure token params.
    const extensionApi = typeof browser !== 'undefined' ? browser : chrome;
    const parameters = new URLSearchParams({
      client_id: this.CLIENT_ID,
      redirect_uri: this.REDIRECT_URL,
      scope: this.SCOPES.join(' '),
    });
    const url = `${this.AUTHORIZATION_URL}?${parameters}`;

    await extensionApi.storage.local.set({
      pipe_leethub: true,
      github_auth_status: 'connecting',
    });
    await extensionApi.tabs.create({ url, active: true });
  },
};
