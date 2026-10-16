import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { openProjectDatabase } from '../../src/storage/project-database.js';

describe('openProjectDatabase', () => {
  test('uses a stable database location for the same project', () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'mini-sandbox-'));

    const first = openProjectDatabase(dataDirectory, '/projects/example');
    first.database.close();
    const second = openProjectDatabase(dataDirectory, '/projects/example');

    expect(second.projectId).toBe(first.projectId);
    expect(second.path).toBe(first.path);
    expect(existsSync(second.path)).toBe(true);

    second.database.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  test('isolates different projects in different database files', () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'mini-sandbox-'));

    const first = openProjectDatabase(dataDirectory, '/projects/first');
    const second = openProjectDatabase(dataDirectory, '/projects/second');

    expect(second.projectId).not.toBe(first.projectId);
    expect(second.path).not.toBe(first.path);

    first.database.close();
    second.database.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  test('configures connections for shared access', () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'mini-sandbox-'));
    const project = openProjectDatabase(dataDirectory, '/projects/example');

    expect(project.database.pragma('journal_mode', { simple: true })).toBe(
      'wal',
    );
    expect(project.database.pragma('busy_timeout', { simple: true })).toBe(
      5000,
    );

    project.database.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  test('allows two connections to perform basic writes', () => {
    const dataDirectory = mkdtempSync(join(tmpdir(), 'mini-sandbox-'));
    const first = openProjectDatabase(dataDirectory, '/projects/example');
    const second = openProjectDatabase(dataDirectory, '/projects/example');
    first.database.exec('CREATE TABLE shared_writes (value TEXT NOT NULL)');

    first.database.prepare('INSERT INTO shared_writes VALUES (?)').run('one');
    second.database.prepare('INSERT INTO shared_writes VALUES (?)').run('two');

    expect(
      first.database.prepare('SELECT value FROM shared_writes ORDER BY value').all(),
    ).toEqual([{ value: 'one' }, { value: 'two' }]);

    first.database.close();
    second.database.close();
    rmSync(dataDirectory, { recursive: true, force: true });
  });
});
