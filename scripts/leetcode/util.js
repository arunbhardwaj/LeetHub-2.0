/* Enum for languages supported by LeetCode. */
const languages = {
  C: '.c',
  'C++': '.cpp',
  'C#': '.cs',
  Dart: '.dart',
  Elixir: '.ex',
  Erlang: '.erl',
  Go: '.go',
  Java: '.java',
  JavaScript: '.js',
  Javascript: '.js',
  Kotlin: '.kt',
  MySQL: '.sql',
  'MS SQL Server': '.sql',
  Oracle: '.sql',
  Pandas: '.py',
  PHP: '.php',
  Python: '.py',
  Python3: '.py',
  Racket: '.rkt',
  Ruby: '.rb',
  Rust: '.rs',
  Scala: '.scala',
  Swift: '.swift',
  TypeScript: '.ts',
};

const DIFFICULTY = Object.freeze({
  EASY: 'Easy',
  MEDIUM: 'Medium',
  HARD: 'Hard',
  UNKNOWN: 'Unknown',
});

class LeetHubError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LeetHubErr';
  }
}

class RepoReadmeNotFoundErr extends LeetHubError {
  constructor(message, topicTags, problemName) {
    super(message);
    this.topicTags = topicTags;
    this.problemName = problemName;
  }
}

function isEmpty(obj) {
  for (const prop in obj) {
    if (Object.hasOwn(obj, prop)) {
      return false;
    }
  }

  return true;
}

// Returns a function that can be immediately invoked but will start a timeout of 'wait' milliseconds before it can be called again.
function debounce(func, wait, invokeBeforeTimeout) {
  let timeout;
  return function () {
    const context = this,
      args = arguments;
    const later = function () {
      timeout = null;
      if (!invokeBeforeTimeout) func.apply(context, args);
    };
    const callNow = invokeBeforeTimeout && !timeout;
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    if (callNow) func.apply(context, args);
  };
}

// Delays `func` invocation with `...args` until after `wait` milliseconds
function delay(func, wait, ...args) {
  return setTimeout(() => func(...args), wait);
}

function getBrowser() {
  if (typeof chrome !== 'undefined' && typeof chrome.runtime !== 'undefined') {
    return chrome;
  } else if (typeof browser !== 'undefined' && typeof browser.runtime !== 'undefined') {
    return browser;
  } else {
    throw new LeetHubError('BrowserNotSupported');
  }
}

function getDifficulty(difficulty) {
  difficulty = difficulty.toUpperCase().trim();
  return DIFFICULTY[difficulty] ?? DIFFICULTY.UNKNOWN;
}

/* Checks if an elem/array exists and has length */
function checkElem(elem) {
  return elem && elem.length > 0;
}

function convertToSlug(string) {
  const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;';
  const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------';
  const p = new RegExp(a.split('').join('|'), 'g');

  return string
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
    .replace(/&/g, '-and-') // Replace & with 'and'
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start of text
    .replace(/-+$/, ''); // Trim - from end of text
}

function addLeadingZeros(title) {
  const maxTitlePrefixLength = 4;
  var len = title.split('-')[0].length;
  if (len < maxTitlePrefixLength) {
    return '0'.repeat(4 - len) + title;
  }
  return title;
}

function formatStats(time, timePercentile, space, spacePercentile) {
  return `Time: ${time} (${timePercentile}%), Space: ${space} (${spacePercentile}%) - LeetHub`;
}

function testMergeStats() {
  // Write a JavaScript function that compares 2 objects and merges the value that is higher than the corresponding property in the other object.
  let pStats = JSON.parse('{"easy":1,"hard":0,"medium":2,"shas":{"0001-two-sum":{"0001-two-sum.js":"45331d85767fc68c5d37c719388fa9ded3e89f02","README.md":"295832280eacc9b202138f15adc074a9cb24c66f"},"0002-add-two-numbers":{"0002-add-two-numbers.js":"ad3576c45091bf1a09de17b41401633817d2bbc3","README.md":"466f5e31bfeb151e70b5b325c379cf04183ebb57"},"0003-longest-substring-without-repeating-characters":{"0003-longest-substring-without-repeating-characters.js":"24d32e02558331fc007af68b538cbfaf93757621","README.md":"23fe8b26580352e70c75f4236710f6846864a455"},"README.md":{"":"6840b8562891be5b56e00b1894d0895cd29e763b"},"stats.json":{"":"6869fe483423c5a5fc54f84334cd15d5481851fb"}},"solved":3}')
  let stats = JSON.parse('{"easy":4,"hard":0,"medium":2,"shas":{"0009-palindrome-number":{"0009-palindrome-number.go":"3ebabc3212541ea192c0c608585bcdc949f3c452","README.md":"6fa224a15eebd1946fc517342810124a3207cc25"},"README.md":{"":"6840b8562891be5b56e00b1894d0895cd29e763b"}},"solved":6}')
  let output = mergeStats(pStats, stats)
  JSON.stringify(output) === '{"easy":4,"hard":0,"medium":2,"shas":{"0009-palindrome-number":{"0009-palindrome-number.go":"3ebabc3212541ea192c0c608585bcdc949f3c452","README.md":"6fa224a15eebd1946fc517342810124a3207cc25"},"README.md":{"":"6840b8562891be5b56e00b1894d0895cd29e763b"},"0001-two-sum":{"0001-two-sum.js":"45331d85767fc68c5d37c719388fa9ded3e89f02","README.md":"295832280eacc9b202138f15adc074a9cb24c66f"},"0002-add-two-numbers":{"0002-add-two-numbers.js":"ad3576c45091bf1a09de17b41401633817d2bbc3","README.md":"466f5e31bfeb151e70b5b325c379cf04183ebb57"},"0003-longest-substring-without-repeating-characters":{"0003-longest-substring-without-repeating-characters.js":"24d32e02558331fc007af68b538cbfaf93757621","README.md":"23fe8b26580352e70c75f4236710f6846864a455"},"stats.json":{"":"6869fe483423c5a5fc54f84334cd15d5481851fb"}},"solved":6}'

}

function mergeStats(pStats, stats) {

}

export {
  addLeadingZeros,
  checkElem,
  convertToSlug,
  debounce,
  delay,
  DIFFICULTY,
  formatStats,
  getBrowser,
  getDifficulty,
  isEmpty,
  languages,
  LeetHubError,
  RepoReadmeNotFoundErr,
};
