import { describe, expect, test } from 'vitest';

import { createOutputPreview } from '../../src/core/output-preview.js';
import { utf8ByteLength } from '../../src/core/utf8-byte-length.js';

describe('createOutputPreview', () => {
  test('returns smaller output unchanged', () => {
    expect(createOutputPreview('hello', 6)).toEqual({
      text: 'hello',
      truncated: false,
    });
  });

  test('returns output exactly at the budget unchanged', () => {
    expect(createOutputPreview('中文', 6)).toEqual({
      text: '中文',
      truncated: false,
    });
  });

  test('keeps the head and tail when output exceeds the budget', () => {
    expect(createOutputPreview('abcdefghij', 9)).toEqual({
      text: 'abc…hij',
      truncated: true,
    });
  });

  test('does not split multi-byte characters', () => {
    const preview = createOutputPreview('A中B文C', 8);

    expect(preview).toEqual({ text: 'A…C', truncated: true });
    expect(preview.text).not.toContain('�');
    expect(utf8ByteLength(preview.text)).toBeLessThanOrEqual(8);
  });

  test('uses a safe prefix when the budget cannot fit the marker', () => {
    expect(createOutputPreview('abcdef', 2)).toEqual({
      text: 'ab',
      truncated: true,
    });
  });

  test('returns an empty preview for a zero-byte budget', () => {
    expect(createOutputPreview('abcdef', 0)).toEqual({
      text: '',
      truncated: true,
    });
  });
});
