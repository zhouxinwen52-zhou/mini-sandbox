import { describe, expect, test } from 'vitest';

import { executeCommand } from '../../src/core/execute-command.js';

describe('executeCommand', () => {
  test('captures stdout from a successful command', async () => {
    const result = await executeCommand('printf hello');

    expect(result).toEqual({
      stdout: 'hello',
      stderr: '',
      rawOutput: 'hello',
      exitCode: 0,
      signal: null,
    });
  });

  test('captures stderr separately from stdout', async () => {
    const result = await executeCommand('printf warning >&2');

    expect(result).toEqual({
      stdout: '',
      stderr: 'warning',
      rawOutput: 'warning',
      exitCode: 0,
      signal: null,
    });
  });

  test('returns a non-zero exit code without rejecting', async () => {
    const result = await executeCommand('printf failure >&2; exit 7');

    expect(result).toEqual({
      stdout: '',
      stderr: 'failure',
      rawOutput: 'failure',
      exitCode: 7,
      signal: null,
    });
  });

  test('uses the requested shell to preserve shell-specific semantics', async () => {
    const result = await executeCommand(
      'values=(one two); printf "%s" "${values[1]}"',
      { shell: '/bin/zsh' },
    );

    expect(result.stdout).toBe('one');
    expect(result.stderr).toBe('');
    expect(result.exitCode).toBe(0);
  });

  test('records the terminating signal', async () => {
    const result = await executeCommand('kill -TERM $$');

    expect(result).toEqual({
      stdout: '',
      stderr: '',
      rawOutput: '',
      exitCode: null,
      signal: 'SIGTERM',
    });
  });

  test(
    'closes unused stdin so commands waiting for EOF can finish',
    async () => {
      const result = await executeCommand(
        `${process.execPath} -e "process.stdin.resume(); process.stdin.on('end', () => process.stdout.write('closed'))"`,
      );

      expect(result).toEqual({
        stdout: 'closed',
        stderr: '',
        rawOutput: 'closed',
        exitCode: 0,
        signal: null,
      });
    },
    250,
  );

  test('preserves the observed order of stdout and stderr chunks', async () => {
    const result = await executeCommand(
      `${process.execPath} -e "process.stdout.write('A'); setTimeout(() => process.stderr.write('B'), 20); setTimeout(() => process.stdout.write('C'), 40)"`,
    );

    expect(result.stdout).toBe('AC');
    expect(result.stderr).toBe('B');
    expect(result.rawOutput).toBe('ABC');
  });
});
