import js from '@eslint/js';

const browserGlobals = {
  atob: 'readonly',
  btoa: 'readonly',
  browser: 'readonly',
  chrome: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  CustomEvent: 'readonly',
  document: 'readonly',
  escape: 'readonly',
  fetch: 'readonly',
  FormData: 'readonly',
  globalThis: 'readonly',
  location: 'readonly',
  MutationObserver: 'readonly',
  oAuth2: 'readonly',
  setTimeout: 'readonly',
  structuredClone: 'readonly',
  unescape: 'readonly',
  URL: 'readonly',
  URLSearchParams: 'readonly',
  window: 'readonly',
  XMLHttpRequest: 'readonly',
  $: 'readonly',
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'scripts/jquery-3.3.1.min.js',
      'scripts/semantic-2.4.1.min.js',
    ],
  },
  js.configs.recommended,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: browserGlobals,
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['spec/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...browserGlobals,
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        expectAsync: 'readonly',
        it: 'readonly',
        jasmine: 'readonly',
      },
    },
  },
  {
    files: ['webpack.config.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { process: 'readonly' },
    },
  },
];
