import { describe, expect, test } from 'vitest';

import { utf8ByteLength } from '../../src/core/utf8-byte-length.js';

describe('utf8ByteLength', () => {
  test.each([
    { text: '', bytes: 0, description: 'empty text' },
    { text: 'hello', bytes: 5, description: 'ASCII text' },
    { text: '中文', bytes: 6, description: 'Chinese text' },
    { text: '😀', bytes: 4, description: 'an emoji' },
    { text: 'A中😀', bytes: 8, description: 'mixed text' },
  ])('measures $description in UTF-8 bytes', ({ text, bytes }) => {
    expect(utf8ByteLength(text)).toBe(bytes);
  });
});
