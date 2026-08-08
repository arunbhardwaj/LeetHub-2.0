import path from 'path';
import CopyPlugin from 'copy-webpack-plugin';
import FileManagerPlugin from 'filemanager-webpack-plugin';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const extensionVersion = process.env.npm_package_version;

const ignore = [
  '.DS_Store',
  '**/dist/**',
  '**/.prettierrc',
  '**/.DS_Store',
  '**/scripts/.DS_Store',
  '**/eslint.config.js',
  '**/.env',
  '**/package*',
  '**/webpack*',
  '**/README.md',
  '**/PHASE-*.md',
  '**/FINAL-*.md',
  '**/assets/extension',
  '**/scripts/core/**',
  '**/scripts/gfg/**',
  '**/scripts/welcome.js',
  '**/scripts/popup.js',
  '**/manifest-chrome.json',
  '**/manifest-firefox.json',
];

const folderIgnore = ['**/chrome/**', '**/firefox/**', '**/manifest.json'];

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
    gfg: path.resolve(__dirname, 'scripts', 'gfg', 'index.js'),
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
          to: './manifest.json',
          transform: manifestTransform,
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
          from: 'assets/thumbnail.png',
          to: 'assets/thumbnail.png',
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
        onStart: {
          delete: ['./dist/chrome', './dist/firefox'],
        },
        onEnd: {
          move: [
            {
              source: './dist/gfg.js',
              destination: './dist/scripts/gfg.js',
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
          copy: [
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
