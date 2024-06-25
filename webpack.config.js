const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');
const FileManagerPlugin = require('filemanager-webpack-plugin');

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
  '**/assets/extension', // web store assets
  // ...entries.map((entry) => `**/${entry}.js`),
];

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

module.exports = {
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
          from: './manifest.json',
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
        },
      },
    }),
  ],
};
