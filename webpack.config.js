import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import FileManagerPlugin from 'filemanager-webpack-plugin';
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
  '**/package*',
  '**/webpack*',
  '**/scripts/leetcode/**',
  '**/scripts/welcome.js',
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
          from: 'assets',
          to: 'assets',
          globOptions: {
            ignore,
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
