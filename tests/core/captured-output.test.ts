import { describe, expectTypeOf, test } from 'vitest';

import type { CapturedOutput } from '../../src/core/captured-output.js';

describe('CapturedOutput', () => {
  test('describes captured process streams and exit metadata', () => {
    expectTypeOf<CapturedOutput>().toEqualTypeOf<{
      stdout: string;
      stderr: string;
      rawOutput: string;
      exitCode: number | null;
      signal: NodeJS.Signals | null;
    }>();
  });
});
