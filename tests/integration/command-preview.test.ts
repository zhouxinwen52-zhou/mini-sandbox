import { describe, expect, test } from 'vitest';

import { createOutputPreview } from '../../src/core/output-preview.js';
import { executeCommand } from '../../src/core/execute-command.js';
import { utf8ByteLength } from '../../src/core/utf8-byte-length.js';

describe('command preview integration', () => {
  test('creates a UTF-8-safe bounded preview from real command output', async () => {
    const captured = await executeCommand("printf 'START-中-middle-😀-END'");

    const preview = createOutputPreview(captured.stdout, 15);

    expect(captured).toEqual({
      stdout: 'START-中-middle-😀-END',
      stderr: '',
      rawOutput: 'START-中-middle-😀-END',
      exitCode: 0,
      signal: null,
    });
    expect(preview).toEqual({
      text: 'START-…-END',
      truncated: true,
    });
    expect(utf8ByteLength(preview.text)).toBeLessThanOrEqual(15);
    expect(preview.text).not.toContain('�');
  });
});
