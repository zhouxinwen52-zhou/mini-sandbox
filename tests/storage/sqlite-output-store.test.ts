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
      rawOutput: 'hello',
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

  test('indexes ordered chunks for FTS5 search', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database, {
      maxBytes: 11,
      overlapLines: 1,
    });
    const record: OutputRecord = {
      handle: 'out_searchable',
      projectId: 'project-abc',
      sessionId: 'session-def',
      source: 'ctx_run',
      toolInput: 'printf logs',
      rawOutput: 'alpha\nbeta\ngamma',
      stdout: 'alpha\nbeta\ngamma',
      stderr: '',
      exitCode: 0,
      signal: null,
      byteCount: 16,
      createdAt: '2026-09-30T00:00:00.000Z',
    };

    store.save(record);

    const rows = database
      .prepare(
        `SELECT handle, chunk_index AS chunkIndex, content
         FROM output_chunks
         WHERE output_chunks MATCH ?
         ORDER BY chunk_index`,
      )
      .all('gamma');

    expect(rows).toEqual([
      {
        handle: 'out_searchable',
        chunkIndex: 1,
        content: 'beta\ngamma',
      },
    ]);
    database.close();
  });
});
