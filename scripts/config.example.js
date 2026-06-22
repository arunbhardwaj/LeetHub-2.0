/* 
  LeetHub-2.0 Configuration Template
  -----------------------------------
  Copy this file to config.js and fill in your GitHub OAuth App credentials.
  
  To create your own GitHub OAuth App:
  1. Go to https://github.com/settings/developers
  2. Click "New OAuth App"
  3. Fill in:
     - Application name: LeetHub (or anything)
     - Homepage URL: https://github.com/arunbhardwaj/LeetHub-2.0
     - Authorization callback URL: https://github.com/
  4. Click "Register application"
  5. Copy the Client ID below
  6. Click "Generate a new client secret" and copy it below
  
  IMPORTANT: config.js is gitignored. Never commit your credentials.
*/

// eslint-disable-next-line no-unused-vars
const LEETHUB_CONFIG = {
  CLIENT_ID: 'YOUR_CLIENT_ID_HERE',
  CLIENT_SECRET: 'YOUR_CLIENT_SECRET_HERE',
  REDIRECT_URL: 'https://github.com/',
  SCOPES: ['repo'],
};
