import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { describe, expect, test } from 'vitest';

import { runCli } from '../../src/cli/run-cli.js';
import { SqliteOutputStore } from '../../src/storage/sqlite-output-store.js';

describe('runCli', () => {
  test('prints JSON statistics for the stats command', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);
    store.save({
      handle: 'out_cli-stats',
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
      createdAt: '2026-10-16T00:00:00.000Z',
    });

    expect(JSON.parse(runCli(['stats'], store))).toEqual({
      outputCount: 1,
      rawOutputBytes: 5,
      chunkCount: 1,
    });
    database.close();
  });

  test('purges the store for the purge command', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);
    store.save({
      handle: 'out_cli-purge',
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
      createdAt: '2026-10-16T00:00:00.000Z',
    });

    expect(runCli(['purge'], store)).toBe('Purged stored outputs.');
    expect(store.stats()).toEqual({
      outputCount: 0,
      rawOutputBytes: 0,
      chunkCount: 0,
    });
    database.close();
  });

  test('rebuilds search chunks for the reindex command', () => {
    const database = new Database(':memory:');
    const store = new SqliteOutputStore(database);
    const rawOutput = 'alpha needle omega';
    store.save({
      handle: 'out_cli-reindex',
      projectId: 'project-abc',
      sessionId: 'session-def',
      source: 'ctx_run',
      toolInput: 'printf output',
      rawOutput,
      stdout: rawOutput,
      stderr: '',
      exitCode: 0,
      signal: null,
      byteCount: Buffer.byteLength(rawOutput, 'utf8'),
      createdAt: '2026-10-16T00:00:00.000Z',
    });
    database.exec('DELETE FROM output_chunks');

    expect(runCli(['reindex'], store)).toBe('Reindexed stored outputs.');
    expect(
      store.search({
        projectId: 'project-abc',
        sessionId: 'session-def',
        query: 'needle',
      }),
    ).toMatchObject([{ handle: 'out_cli-reindex' }]);
    database.close();
  });

  test.each([
    { label: 'missing command', args: [] },
    { label: 'unknown command', args: ['unknown'] },
    { label: 'extra argument', args: ['stats', 'extra'] },
  ])(
    'rejects $label',
    ({ args }) => {
      const database = new Database(':memory:');
      const store = new SqliteOutputStore(database);

      expect(() => runCli(args, store)).toThrow(
        'Usage: mini-sandbox stats|purge|reindex',
      );
      database.close();
    },
  );

  test('runs stats through the executable entrypoint', () => {
    const repositoryRoot = process.cwd();
    const directory = mkdtempSync(join(tmpdir(), 'mini-sandbox-cli-'));
    const project = join(directory, 'project');
    const dataDirectory = join(directory, 'data');
    mkdirSync(join(project, '.git'), { recursive: true });

    const stdout = execFileSync(
      process.execPath,
      [
        '--import',
        join(repositoryRoot, 'node_modules', 'tsx', 'dist', 'loader.mjs'),
        join(repositoryRoot, 'src', 'cli.ts'),
        'stats',
      ],
      {
        cwd: project,
        encoding: 'utf8',
        env: {
          ...process.env,
          MINI_SANDBOX_DATA_DIR: dataDirectory,
        },
      },
    );

    expect(JSON.parse(stdout)).toEqual({
      outputCount: 0,
      rawOutputBytes: 0,
      chunkCount: 0,
    });
    rmSync(directory, { recursive: true, force: true });
  });
});
