import { describe, expect, test } from 'vitest';

import { runCtxRun } from '../../src/core/run-ctx-run.js';
import { utf8ByteLength } from '../../src/core/utf8-byte-length.js';

describe('runCtxRun', () => {
  test('returns a bounded emergency preview without a handle when storage fails', async () => {
    const result = await runCtxRun('printf output', {
      projectId: 'project-abc',
      sessionId: 'session-def',
      emergencyPreviewBytes: 12,
      runCommand: async () => ({
        stdout: 'START-中间内容-END',
        stderr: '',
        rawOutput: 'START-中间内容-END',
        exitCode: 0,
        signal: null,
      }),
      storeOutput: () => {
        throw new Error('database unavailable');
      },
    });

    expect(result.isError).toBe(true);
    expect(result.text).toContain('storage failed');
    expect(result.text).not.toContain('handle:');
    expect(result.preview).toBe('START…-END');
    expect(utf8ByteLength(result.preview)).toBeLessThanOrEqual(12);
  });
});
