import { describe, expect, test } from 'vitest';

import { splitText } from '../../src/core/split-text.js';
import { utf8ByteLength } from '../../src/core/utf8-byte-length.js';

describe('splitText', () => {
  test('keeps complete log lines when they fit the byte budget', () => {
    expect(splitText('alpha\nbeta\ngamma', 11)).toEqual([
      'alpha\nbeta\n',
      'gamma',
    ]);
  });

  test('falls back to spaces when one line exceeds the byte budget', () => {
    expect(splitText('alpha beta gamma', 10)).toEqual([
      'alpha ',
      'beta gamma',
    ]);
  });

  test('falls back to UTF-8 character boundaries for text without separators', () => {
    const chunks = splitText('A中🚀B', 4);

    expect(chunks).toEqual(['A中', '🚀', 'B']);
    expect(chunks.every((chunk) => utf8ByteLength(chunk) <= 4)).toBe(true);
    expect(chunks.join('')).toBe('A中🚀B');
    expect(chunks.join('')).not.toContain('�');
  });

  test('overlaps the last complete line when it fits the byte budget', () => {
    expect(splitText('alpha\nbeta\ngamma', 11, 1)).toEqual([
      'alpha\nbeta\n',
      'beta\ngamma',
    ]);
  });
});
