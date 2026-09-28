import { describe, expectTypeOf, test } from 'vitest';

import type {
  OutputRecord,
  OutputStore,
} from '../../src/core/output-record.js';

describe('OutputRecord', () => {
  test('describes one complete stored command output', () => {
    expectTypeOf<OutputRecord>().toEqualTypeOf<{
      handle: string;
      projectId: string;
      sessionId: string;
      source: string;
      toolInput: string;
      stdout: string;
      stderr: string;
      exitCode: number | null;
      signal: NodeJS.Signals | null;
      byteCount: number;
      createdAt: string;
    }>();
  });

  test('defines the storage operations needed by the core', () => {
    expectTypeOf<OutputStore>().toEqualTypeOf<{
      save(record: OutputRecord): void;
      findByHandle(handle: string): OutputRecord | undefined;
    }>();
  });
});
