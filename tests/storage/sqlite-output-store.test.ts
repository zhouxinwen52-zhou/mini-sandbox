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

  test('rolls back the record and earlier chunks when indexing fails', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database, {
      maxBytes: 11,
      overlapLines: 1,
    });
    const record: OutputRecord = {
      handle: 'out_rollback',
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

    database.exec(`
      DROP TABLE output_chunks;
      CREATE TABLE output_chunks (
        handle TEXT NOT NULL,
        project_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL CHECK (content NOT LIKE '%gamma%')
      );
    `);

    expect(() => store.save(record)).toThrow();
    expect(store.findByHandle(record.handle)).toBeUndefined();
    expect(
      database
        .prepare('SELECT COUNT(*) AS count FROM output_chunks')
        .get(),
    ).toEqual({ count: 0 });
    database.close();
  });

  test('rebuilds the derived search index from raw output records', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database, {
      maxBytes: 11,
      overlapLines: 1,
    });
    const record: OutputRecord = {
      handle: 'out_reindex',
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
    const search = database.prepare(
      `SELECT handle, chunk_index AS chunkIndex, content
       FROM output_chunks
       WHERE output_chunks MATCH ?
       ORDER BY chunk_index`,
    );

    store.save(record);
    database.exec('DELETE FROM output_chunks');
    expect(search.all('gamma')).toEqual([]);

    store.reindex();

    expect(search.all('gamma')).toEqual([
      {
        handle: 'out_reindex',
        chunkIndex: 1,
        content: 'beta\ngamma',
      },
    ]);
    database.close();
  });

  test('searches only the current session and ranks matches by BM25 relevance', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);
    const createRecord = (
      handle: string,
      sessionId: string,
      rawOutput: string,
    ): OutputRecord => ({
      handle,
      projectId: 'project-abc',
      sessionId,
      source: 'ctx_run',
      toolInput: 'printf logs',
      rawOutput,
      stdout: rawOutput,
      stderr: '',
      exitCode: 0,
      signal: null,
      byteCount: Buffer.byteLength(rawOutput, 'utf8'),
      createdAt: '2026-10-14T00:00:00.000Z',
    });

    store.save(
      createRecord('out_less-relevant', 'session-current', 'needle nearby'),
    );
    store.save(
      createRecord(
        'out_more-relevant',
        'session-current',
        'needle needle needle nearby',
      ),
    );
    store.save(
      createRecord(
        'out_other-session',
        'session-other',
        'needle needle needle needle',
      ),
    );

    const results = store.search({
      projectId: 'project-abc',
      sessionId: 'session-current',
      query: 'needle',
    });

    expect(results.map(({ handle }) => handle)).toEqual([
      'out_more-relevant',
      'out_less-relevant',
    ]);
    expect(results.every(({ score }) => score < 0)).toBe(true);
    database.close();
  });

  test('an exact handle can search a historical session and respects the limit', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database, {
      maxBytes: 12,
      overlapLines: 0,
    });
    const record: OutputRecord = {
      handle: 'out_historical',
      projectId: 'project-abc',
      sessionId: 'session-historical',
      source: 'ctx_run',
      toolInput: 'printf logs',
      rawOutput: 'needle one\nneedle two',
      stdout: 'needle one\nneedle two',
      stderr: '',
      exitCode: 0,
      signal: null,
      byteCount: 21,
      createdAt: '2026-10-14T00:00:00.000Z',
    };
    store.save(record);

    const results = store.search({
      projectId: 'project-abc',
      sessionId: 'session-current',
      handle: 'out_historical',
      query: 'needle',
      limit: 1,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.handle).toBe('out_historical');
    database.close();
  });

  test('returns an FTS5 snippet with highlighted matches', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);
    const rawOutput = 'alpha needle omega';
    store.save({
      handle: 'out_snippet',
      projectId: 'project-abc',
      sessionId: 'session-current',
      source: 'ctx_run',
      toolInput: 'printf logs',
      rawOutput,
      stdout: rawOutput,
      stderr: '',
      exitCode: 0,
      signal: null,
      byteCount: Buffer.byteLength(rawOutput, 'utf8'),
      createdAt: '2026-10-14T00:00:00.000Z',
    });

    const [result] = store.search({
      projectId: 'project-abc',
      sessionId: 'session-current',
      query: 'needle',
    });

    expect(result?.snippet).toBe('alpha [needle] omega');
    expect(result).not.toHaveProperty('content');
    database.close();
  });
});
