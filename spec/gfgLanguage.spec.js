import { LANGUAGE_EXTENSIONS, normalizeLanguage } from '../scripts/core/languages.js';

describe('GFG language normalization', () => {
  it('normalizes selected display names and version suffixes', () => {
    expect(normalizeLanguage('Java')).toEqual(
      jasmine.objectContaining({ normalized: 'java', extension: '.java' })
    );
    expect(normalizeLanguage('Java 21')).toEqual(
      jasmine.objectContaining({ normalized: 'java', extension: '.java' })
    );
    expect(normalizeLanguage('Python3')).toEqual(
      jasmine.objectContaining({ normalized: 'python', extension: '.py' })
    );
    expect(normalizeLanguage('Python 3')).toEqual(
      jasmine.objectContaining({ normalized: 'python', extension: '.py' })
    );
    expect(normalizeLanguage('C++ (17)')).toEqual(
      jasmine.objectContaining({ normalized: 'cpp', extension: '.cpp' })
    );
    expect(normalizeLanguage('Javascript')).toEqual(
      jasmine.objectContaining({ normalized: 'javascript', extension: '.js' })
    );
    expect(normalizeLanguage('JavaScript')).toEqual(
      jasmine.objectContaining({ normalized: 'javascript', extension: '.js' })
    );
  });

  it('does not invent an extension for an unknown language', () => {
    expect(normalizeLanguage('Haskell')).toBeNull();
    expect(LANGUAGE_EXTENSIONS.Haskell).toBeUndefined();
  });

  it('maps normalized languages to the expected source extensions', () => {
    expect(normalizeLanguage('C').extension).toBe('.c');
    expect(normalizeLanguage('C++20').extension).toBe('.cpp');
    expect(normalizeLanguage('Java').extension).toBe('.java');
    expect(normalizeLanguage('Python3').extension).toBe('.py');
    expect(normalizeLanguage('JavaScript').extension).toBe('.js');
    expect(normalizeLanguage('C#').extension).toBe('.cs');
    expect(normalizeLanguage('Go').extension).toBe('.go');
    expect(normalizeLanguage('Kotlin').extension).toBe('.kt');
    expect(normalizeLanguage('Rust').extension).toBe('.rs');
  });
});
