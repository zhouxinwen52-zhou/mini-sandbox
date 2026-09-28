import Database from 'better-sqlite3';
import { describe, expect, test } from 'vitest';

import { createStoreOutput } from '../../src/core/store-output.js';
import { SqliteOutputStore } from '../../src/storage/sqlite-output-store.js';

describe('StoreOutput', () => {
  test('adds generated metadata, stores the record, and returns a preview', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);
    const storeOutput = createStoreOutput({
      store,
      previewBytes: 12,
      createHandle: () => 'out_fixed-123',
      now: () => new Date('2026-09-28T01:02:03.000Z'),
    });

    const result = storeOutput({
      projectId: 'project-abc',
      sessionId: 'session-def',
      source: 'ctx_run',
      toolInput: 'printf output',
      rawOutput: 'START-中间内容-END',
      stdout: 'START-中间内容-END',
      stderr: '',
      exitCode: 0,
      signal: null,
    });

    expect(result).toEqual({
      handle: 'out_fixed-123',
      preview: 'START…-END',
      truncated: true,
      byteCount: 22,
    });
    expect(store.findByHandle('out_fixed-123')).toEqual({
      handle: 'out_fixed-123',
      projectId: 'project-abc',
      sessionId: 'session-def',
      source: 'ctx_run',
      toolInput: 'printf output',
      rawOutput: 'START-中间内容-END',
      stdout: 'START-中间内容-END',
      stderr: '',
      exitCode: 0,
      signal: null,
      byteCount: 22,
      createdAt: '2026-09-28T01:02:03.000Z',
    });

    database.close();
  });
});
