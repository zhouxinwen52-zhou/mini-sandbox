import Database from 'better-sqlite3';
import { describe, expect, test } from 'vitest';

import type { OutputRecord } from '../../src/core/output-record.js';
import { SqliteOutputStore } from '../../src/storage/sqlite-output-store.js';

describe('SqliteOutputStore', () => {
  test('saves and retrieves an output record by handle', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);
    const record: OutputRecord = {
      handle: 'out_test-123',
      projectId: 'project-abc',
      sessionId: 'session-def',
      source: 'ctx_run',
      toolInput: 'printf hello',
      stdout: 'hello',
      stderr: '',
      exitCode: 0,
      signal: null,
      byteCount: 5,
      createdAt: '2026-09-28T00:00:00.000Z',
    };

    store.save(record);

    expect(store.findByHandle(record.handle)).toEqual(record);
    database.close();
  });

  test('returns undefined when the handle does not exist', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);

    expect(store.findByHandle('out_missing')).toBeUndefined();
    database.close();
  });
});
