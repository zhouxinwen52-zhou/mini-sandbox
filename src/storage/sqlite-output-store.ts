import type Database from 'better-sqlite3';

import type { OutputRecord, OutputStore } from '../core/output-record.js';
import { splitText } from '../core/split-text.js';

export interface OutputChunkingOptions {
  maxBytes: number;
  overlapLines: number;
}

const DEFAULT_CHUNKING_OPTIONS: OutputChunkingOptions = {
  maxBytes: 4 * 1024,
  overlapLines: 1,
};

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
}
