import { LeetHubError } from "./util.js";

const leetCodeSectionStart = `<!---LeetCode Topics Start-->`;
const leetCodeSectionHeader = `# LeetCode Topics`;
const leetCodeSectionEnd = `<!---LeetCode Topics End-->`;

function appendProblemToReadme(topic, markdownFile, hook, problem) {
  const url = `https://github.com/${hook}/tree/master/${problem}`;
  const topicHeader = `## ${topic}`;
  const topicTableHeader = `\n${topicHeader}\n|  |\n| ------- |\n`;
  const newRow = `| [${problem}](${url}) |`;

  // Check if the LeetCode Section exists, or add it
  let leetCodeSectionStartIndex = markdownFile.indexOf(leetCodeSectionStart);
  if (leetCodeSectionStartIndex === -1) {
    markdownFile +=
      '\n' + [leetCodeSectionStart, leetCodeSectionHeader, leetCodeSectionEnd].join('\n');
    leetCodeSectionStartIndex = markdownFile.indexOf(leetCodeSectionStart);
  }

  // Get LeetCode section and the Before & After sections
  const beforeSection = markdownFile.slice(0, markdownFile.indexOf(leetCodeSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(leetCodeSectionEnd) + leetCodeSectionEnd.length,
  );

  let leetCodeSection = markdownFile.slice(
    markdownFile.indexOf(leetCodeSectionStart) + leetCodeSectionStart.length,
    markdownFile.indexOf(leetCodeSectionEnd),
  );

  // Check if topic table exists, or add it
  let topicTableIndex = leetCodeSection.indexOf(topicHeader);
  if (topicTableIndex === -1) {
    leetCodeSection += topicTableHeader;
    topicTableIndex = leetCodeSection.indexOf(topicHeader);
  }

  // Get the Topic table. If topic table was just added, then its end === LeetCode Section end
  const endTopicString = leetCodeSection.slice(topicTableIndex).match(/\|\n[^|]/)?.[0];
  const endTopicIndex = (endTopicString != null) ? leetCodeSection.indexOf(endTopicString, topicTableIndex + 1) : -1;
  let topicTable =
    endTopicIndex === -1
      ? leetCodeSection.slice(topicTableIndex)
      : leetCodeSection.slice(topicTableIndex, endTopicIndex + 1);
  topicTable = topicTable.trim();

  // Check if the problem exists in topic table, prevent duplicate add
  const problemIndex = topicTable.indexOf(problem);
  if (problemIndex !== -1) {
    return markdownFile;
  }

  // Append problem to the Topic
  topicTable = [topicTable, newRow, '\n'].join('\n');

  // Replace the old Topic table with the updated one in the markdown file
  leetCodeSection =
    leetCodeSection.slice(0, topicTableIndex) +
    topicTable +
    (endTopicIndex === -1 ? '' : leetCodeSection.slice(endTopicIndex + 1));

  markdownFile = [
    beforeSection,
    leetCodeSectionStart,
    leetCodeSection,
    leetCodeSectionEnd,
    afterSection,
  ].join('');

  return markdownFile;
}

const DEFAULT_FALLBACK_TOPIC = 'Untagged/Others';

/**
 * Determines the fallback category for a problem when topic tags are missing or empty.
 * Supports explicit string categories or options with categoryTitle, category, language, lang, and defaultTopic.
 * @param {Object|string} [options] - Options or fallback string (e.g. { categoryTitle, language, defaultTopic })
 * @returns {string} The resolved fallback topic name
 */
function getFallbackTopic(options = {}) {
  if (typeof options === 'string' && options.trim().length > 0) {
    return options.trim();
  }

  const {
    categoryTitle,
    category,
    language,
    lang,
    defaultTopic = DEFAULT_FALLBACK_TOPIC,
  } = options || {};

  const cat = (categoryTitle || category || '').trim();
  if (cat && cat.toLowerCase() !== 'algorithms') {
    return cat;
  }

  const languageStr = (
    typeof language === 'string'
      ? language
      : typeof lang === 'string'
      ? lang
      : lang?.verboseName || lang?.name || ''
  ).trim();

  const lowerLang = languageStr.toLowerCase();

  if (lowerLang.includes('pandas')) {
    return 'Pandas';
  }
  if (lowerLang.includes('python') || lowerLang === 'py' || lowerLang === '.py') {
    return 'Python';
  }
  if (
    lowerLang.includes('sql') ||
    lowerLang.includes('mysql') ||
    lowerLang.includes('oracle')
  ) {
    return 'Database';
  }
  if (
    lowerLang.includes('javascript') ||
    lowerLang.includes('typescript') ||
    lowerLang === '.js' ||
    lowerLang === '.ts'
  ) {
    return 'JavaScript';
  }

  return defaultTopic || DEFAULT_FALLBACK_TOPIC;
}

/**
 * Normalizes topic tags or falls back to a default category when topic tags are absent or empty.
 * @param {Array<Object|string>|Object|string|null|undefined} topicTags - Topic tags from LeetCode
 * @param {Object|string} [fallbackOptions] - Options/hints for fallback categorization
 * @returns {Array<{name: string}>} Array of topic objects with a 'name' property
 */
function getTopicTags(topicTags, fallbackOptions = {}) {
  let parsedTopics = [];

  if (Array.isArray(topicTags)) {
    for (const tag of topicTags) {
      if (!tag) continue;
      const name = typeof tag === 'string' ? tag.trim() : tag?.name?.trim?.();
      if (name) {
        parsedTopics.push({ name });
      }
    }
  } else if (topicTags) {
    const name = typeof topicTags === 'string' ? topicTags.trim() : topicTags?.name?.trim?.();
    if (name) {
      parsedTopics.push({ name });
    }
  }

  if (parsedTopics.length === 0) {
    const fallbackName = getFallbackTopic(fallbackOptions);
    parsedTopics = [{ name: fallbackName }];
  }

  return parsedTopics;
}

// Sorts each Topic table by the problem number
function sortTopicsInReadme(markdownFile) {
  let beforeSection = markdownFile.slice(0, markdownFile.indexOf(leetCodeSectionStart));
  const afterSection = markdownFile.slice(
    markdownFile.indexOf(leetCodeSectionEnd) + leetCodeSectionEnd.length,
  );

  // Matches any text between the start and end tags. Should never fail to match.
  const leetCodeSection = markdownFile.match(
    new RegExp(`${leetCodeSectionStart}([\\s\\S]*)${leetCodeSectionEnd}`),
  )?.[1];
  if (leetCodeSection == null) throw new LeetHubError('LeetCodeTopicSectionNotFound');
  

  // Remove the header
  let topics = leetCodeSection.trim().split('## ');
  topics.shift();

  // Get Array<sorted-topic>
  topics = topics.map(section => {
    let lines = section.trim().split('\n');

    // Get the problem topic
    const topic = lines.shift();

    // Check if topic exists elsewhere
    let topicHeaderIndex = markdownFile.indexOf(`## ${topic}`);
    let leetCodeSectionStartIndex = markdownFile.indexOf(leetCodeSectionStart);
    if (topicHeaderIndex < leetCodeSectionStartIndex) {
      // matches the next '|\n' that doesn't precede a '|'. Typically this is '|\n#. Should always match if topic existed elsewhere.
      const endTopicString = markdownFile.slice(topicHeaderIndex).match(/\|\n[^|]/)?.[0];
      if (endTopicString == null) throw new LeetHubError('EndOfTopicNotFound');

      // Get the old problems for merge
      const endTopicIndex = markdownFile.indexOf(endTopicString, topicHeaderIndex + 1);
      const topicSection = markdownFile.slice(topicHeaderIndex, endTopicIndex + 1);
      const problemsToMerge = topicSection.trim().split('\n').slice(3);

      // Merge previously solved problems and removes duplicates
      lines = lines.concat(problemsToMerge).reduce((array, element) => {
        if (!array.includes(element)) {
          array.push(element);
        }
        return array;
      }, []);

      // Delete the old topic section after merging
      beforeSection =
        markdownFile.slice(0, topicHeaderIndex) +
        markdownFile.slice(endTopicIndex + 1, markdownFile.indexOf(leetCodeSectionStart));
    }

    // Remove the header and header separator
    lines = lines.slice(2);

    lines.sort((a, b) => {
      const matchA = a.match(/\/(\d+)-/);
      const matchB = b.match(/\/(\d+)-/);
      const numA = matchA ? parseInt(matchA[1], 10) : 0;
      const numB = matchB ? parseInt(matchB[1], 10) : 0;
      if (numA !== numB) {
        return numA - numB;
      }
      return a.localeCompare(b);
    });

    // Reconstruct the topic
    return ['## ' + topic].concat('|  |', '| ------- |', lines).join('\n');
  });

  // Reconstruct the file
  markdownFile =
    beforeSection +
    [leetCodeSectionStart, leetCodeSectionHeader, ...topics, leetCodeSectionEnd].join('\n') +
    afterSection;

  return markdownFile;
}

export {
  appendProblemToReadme,
  DEFAULT_FALLBACK_TOPIC,
  getFallbackTopic,
  getTopicTags,
  sortTopicsInReadme,
};

