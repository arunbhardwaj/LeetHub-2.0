import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import FileManagerPlugin from 'filemanager-webpack-plugin';
// https://stackoverflow.com/a/62892482/
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const entries = ['leetcode', 'welcome'];
const extensionVersion = process.env.npm_package_version;

// Ignore when copying
const ignore = [
  '**/dist/**',
  '**/.prettierrc',
  '**/.eslintrc',
  '**/.env',
  '**/assets/.DS_Store',
  '**/package*',
  '**/webpack*',
  '**/scripts/leetcode/**',
  '**/scripts/welcome.js',
  '**/scripts/popup.js',
  '**/README.md',
  '**/manifest-chrome.json',
  '**/manifest-firefox.json',
  '**/assets/extension', // web store assets
  // ...entries.map((entry) => `**/${entry}.js`),
];

const folderIgnore = [
  '**/chrome/**',
  '**/firefox/**',
  '**/manifest.json',
]

const manifestTransform = content => {
  const filteredContent = content
    .toString()
    .split('\n')
    .filter(str => !str.trimStart().startsWith('//'))
    .join('\n');

  const manifestData = JSON.parse(filteredContent);
  manifestData.version = extensionVersion;
  return JSON.stringify(manifestData, null, 2);
};

export default {
  entry: {
    leetcode: path.resolve(__dirname, 'scripts', 'leetcode', 'leetcode.js'),
    welcome: './scripts/welcome.js',
    popup: './scripts/popup.js',
  },
  watchOptions: {
    ignored: '**/dist/**',
  },
  optimization: {
    minimize: false,
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: '/dist/',
    filename: '[name].js',
    clean: true,
  },
  module: {
    rules: [
      {
        test: /\.(test)|(spec)\.js$/,
        use: 'ignore-loader',
      },
    ],
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: './scripts',
          to: './scripts',
          globOptions: {
            ignore,
          },
        },
        {
          from: '*',
          globOptions: {
            gitignore: true,
            ignore,
          },
        },
        {
          from: './manifest-chrome.json',
          to: './chrome/manifest.json',
          transform: manifestTransform,
        },
        {
          from: './manifest-firefox.json',
          to: './firefox/manifest.json',
          transform: manifestTransform,
        },
        {
          from: 'assets/**',
          globOptions: {
            ignore: [
              ...ignore,
              './assets/.DS_Store'
            ],
          },
        },
        {
          from: 'css',
          to: 'css',
          globOptions: {
            ignore,
          },
        },
      ],
    }),
    new FileManagerPlugin({
      events: {
        onEnd: {
          move: [
            {
              source: './dist/leetcode.js',
              destination: './dist/scripts/leetcode.js',
            },
            {
              source: './dist/welcome.js',
              destination: './dist/scripts/welcome.js',
            },
            {
              source: './dist/popup.js',
              destination: './dist/scripts/popup.js',
            },
          ],
          copy: [ // Copy everything to chrome and firefox
            {
              source: './dist/**',
              destination: './dist/chrome',
              globOptions: {
                ignore: folderIgnore,
              },
            },
            {
              source: './dist/**',
              destination: './dist/firefox',
              globOptions: {
                ignore: folderIgnore,
              },
            },
          ],
        },
      },
    }),
  ],
};
