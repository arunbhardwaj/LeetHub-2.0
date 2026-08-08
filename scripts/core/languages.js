const LANGUAGE_DEFINITIONS = Object.freeze([
  { normalized: 'c', extension: '.c', aliases: ['c'] },
  { normalized: 'cpp', extension: '.cpp', aliases: ['c++', 'cpp'] },
  { normalized: 'csharp', extension: '.cs', aliases: ['c#', 'csharp'] },
  { normalized: 'dart', extension: '.dart', aliases: ['dart'] },
  { normalized: 'go', extension: '.go', aliases: ['go', 'golang'] },
  { normalized: 'java', extension: '.java', aliases: ['java'] },
  {
    normalized: 'javascript',
    extension: '.js',
    aliases: ['javascript', 'js', 'node.js', 'nodejs'],
  },
  { normalized: 'kotlin', extension: '.kt', aliases: ['kotlin'] },
  { normalized: 'php', extension: '.php', aliases: ['php'] },
  { normalized: 'python', extension: '.py', aliases: ['python', 'python3'] },
  { normalized: 'ruby', extension: '.rb', aliases: ['ruby'] },
  { normalized: 'rust', extension: '.rs', aliases: ['rust'] },
  { normalized: 'scala', extension: '.scala', aliases: ['scala'] },
  { normalized: 'swift', extension: '.swift', aliases: ['swift'] },
  { normalized: 'typescript', extension: '.ts', aliases: ['typescript', 'ts'] },
]);

const LANGUAGE_EXTENSIONS = Object.freeze({
  ...Object.fromEntries(
    LANGUAGE_DEFINITIONS.flatMap(({ extension, aliases }) =>
      aliases.map(alias => [
        alias
          .split(/\s*\(/)[0]
          .replace(/\s+/g, ' ')
          .replace(/^./, character => character.toUpperCase()),
        extension,
      ])
    )
  ),
  JavaScript: '.js',
});

export function normalizeLanguage(displayName) {
  const display = String(displayName ?? '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!display) return null;

  const baseName = display
    .split('(')[0]
    .trim()
    .toLowerCase()
    .replace(/\s*\d+(?:\.\d+)?$/, '');
  const definition = LANGUAGE_DEFINITIONS.find(({ aliases }) => aliases.includes(baseName));
  if (!definition) return null;

  return Object.freeze({
    displayName: display,
    normalized: definition.normalized,
    extension: definition.extension,
  });
}

export { LANGUAGE_DEFINITIONS, LANGUAGE_EXTENSIONS };
