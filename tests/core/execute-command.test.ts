import { describe, expect, test } from 'vitest';

import { executeCommand } from '../../src/core/execute-command.js';

describe('executeCommand', () => {
  test('captures stdout from a successful command', async () => {
    const result = await executeCommand('printf hello');

    expect(result).toEqual({
      stdout: 'hello',
      stderr: '',
      exitCode: 0,
      signal: null,
    });
  });

  test('captures stderr separately from stdout', async () => {
    const result = await executeCommand('printf warning >&2');

    expect(result).toEqual({
      stdout: '',
      stderr: 'warning',
      exitCode: 0,
      signal: null,
    });
  });

  test('returns a non-zero exit code without rejecting', async () => {
    const result = await executeCommand('printf failure >&2; exit 7');

    expect(result).toEqual({
      stdout: '',
      stderr: 'failure',
      exitCode: 7,
      signal: null,
    });
  });

  test('records the terminating signal', async () => {
    const result = await executeCommand('kill -TERM $$');

    expect(result).toEqual({
      stdout: '',
      stderr: '',
      exitCode: null,
      signal: 'SIGTERM',
    });
  });
});
