import type Database from 'better-sqlite3';

import type { OutputRecord, OutputStore } from '../core/output-record.js';
import { splitText } from '../core/split-text.js';

export interface OutputChunkingOptions {
  maxBytes: number;
  overlapLines: number;
}

export interface SearchOutputChunksInput {
  projectId: string;
  sessionId: string;
  query: string;
  handle?: string;
  limit?: number;
}

export interface OutputChunkSearchResult {
  handle: string;
  chunkIndex: number;
  snippet: string;
  score: number;
}

export interface OutputStoreStats {
  outputCount: number;
  rawOutputBytes: number;
  chunkCount: number;
}

const DEFAULT_CHUNKING_OPTIONS: OutputChunkingOptions = {
  maxBytes: 4 * 1024,
  overlapLines: 1,
};
const MAX_REINDEX_ATTEMPTS = 3;

interface OutputRow {
  handle: string;
  project_id: string;
  session_id: string;
  source: string;
  tool_input: string;
  raw_output: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  signal: NodeJS.Signals | null;
  byte_count: number;
  created_at: string;
}

interface ReindexRow {
  handle: string;
  project_id: string;
  session_id: string;
  raw_output: string;
}

export class SqliteOutputStore implements OutputStore {
  public constructor(
    private readonly database: Database.Database,
    private readonly chunking: OutputChunkingOptions = DEFAULT_CHUNKING_OPTIONS,
  ) {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS outputs (
        handle TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        source TEXT NOT NULL,
        tool_input TEXT NOT NULL,
        raw_output TEXT NOT NULL,
        stdout TEXT NOT NULL,
        stderr TEXT NOT NULL,
        exit_code INTEGER,
        signal TEXT,
        byte_count INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS output_chunks USING fts5(
        handle UNINDEXED,
        project_id UNINDEXED,
        session_id UNINDEXED,
        chunk_index UNINDEXED,
        content
      );
    `);
  }

  public save(record: OutputRecord): void {
    const chunks = splitText(
      record.rawOutput,
      this.chunking.maxBytes,
      this.chunking.overlapLines,
    );

    const saveRecordAndChunks = this.database.transaction(() => {
      this.database
        .prepare(
          `INSERT INTO outputs (
            handle, project_id, session_id, source, tool_input, raw_output,
            stdout, stderr, exit_code, signal, byte_count, created_at
          ) VALUES (
            @handle, @projectId, @sessionId, @source, @toolInput, @rawOutput,
            @stdout, @stderr, @exitCode, @signal, @byteCount, @createdAt
          )`,
        )
        .run(record);

      const insertChunk = this.database.prepare(
        `INSERT INTO output_chunks (
          handle, project_id, session_id, chunk_index, content
        ) VALUES (?, ?, ?, ?, ?)`,
      );

      for (const [chunkIndex, content] of chunks.entries()) {
        insertChunk.run(
          record.handle,
          record.projectId,
          record.sessionId,
          chunkIndex,
          content,
        );
      }
    });

    saveRecordAndChunks();
  }

  public findByHandle(handle: string): OutputRecord | undefined {
    const row = this.database
      .prepare('SELECT * FROM outputs WHERE handle = ?')
      .get(handle) as OutputRow | undefined;

    if (row === undefined) {
      return undefined;
    }

    return {
      handle: row.handle,
      projectId: row.project_id,
      sessionId: row.session_id,
      source: row.source,
      toolInput: row.tool_input,
      rawOutput: row.raw_output,
      stdout: row.stdout,
      stderr: row.stderr,
      exitCode: row.exit_code,
      signal: row.signal,
      byteCount: row.byte_count,
      createdAt: row.created_at,
    };
  }

  public stats(): OutputStoreStats {
    return this.database
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM outputs) AS outputCount,
           (SELECT COALESCE(SUM(byte_count), 0) FROM outputs) AS rawOutputBytes,
           (SELECT COUNT(*) FROM output_chunks) AS chunkCount`,
      )
      .get() as OutputStoreStats;
  }

  public purge(): void {
    this.database.transaction(() => {
      this.database.exec(`
        DELETE FROM output_chunks;
        DELETE FROM outputs;
      `);
    })();
  }

  public search(
    input: SearchOutputChunksInput,
  ): OutputChunkSearchResult[] {
    return this.database
      .prepare(
        `SELECT
           handle,
           chunk_index AS chunkIndex,
           snippet(output_chunks, 4, '[', ']', ' … ', 16) AS snippet,
           bm25(output_chunks) AS score
         FROM output_chunks
         WHERE output_chunks MATCH @query
           AND project_id = @projectId
           AND (
             (@handle IS NULL AND session_id = @sessionId)
             OR handle = @handle
           )
         ORDER BY score ASC, handle ASC, chunk_index ASC
         LIMIT @limit`,
      )
      .all({
        ...input,
        handle: input.handle ?? null,
        limit: input.limit ?? 10,
      }) as OutputChunkSearchResult[];
  }

  public reindex(): void {
    for (let attempt = 0; attempt < MAX_REINDEX_ATTEMPTS; attempt += 1) {
      const rows = this.database
        .prepare(
          `SELECT handle, project_id, session_id, raw_output
           FROM outputs
           ORDER BY created_at, handle`,
        )
        .all() as ReindexRow[];
      const indexedRecords = rows.map((row) => ({
        handle: row.handle,
        projectId: row.project_id,
        sessionId: row.session_id,
        chunks: splitText(
          row.raw_output,
          this.chunking.maxBytes,
          this.chunking.overlapLines,
        ),
      }));

      const rebuildIndex = this.database.transaction(() => {
        const currentHandles = this.database
          .prepare(
            `SELECT handle
             FROM outputs
             ORDER BY created_at, handle`,
          )
          .all() as Array<{ handle: string }>;
        const snapshotMatches =
          currentHandles.length === rows.length &&
          currentHandles.every(
            (row, index) => row.handle === rows[index]?.handle,
          );

        if (!snapshotMatches) {
          return false;
        }

        this.database.exec('DELETE FROM output_chunks');

        const insertChunk = this.database.prepare(
          `INSERT INTO output_chunks (
            handle, project_id, session_id, chunk_index, content
          ) VALUES (?, ?, ?, ?, ?)`,
        );

        for (const record of indexedRecords) {
          for (const [chunkIndex, content] of record.chunks.entries()) {
            insertChunk.run(
              record.handle,
              record.projectId,
              record.sessionId,
              chunkIndex,
              content,
            );
          }
        }
        return true;
      });

      if (rebuildIndex.immediate()) {
        return;
      }
    }

    throw new Error('reindex failed because stored outputs kept changing');
  }
}
