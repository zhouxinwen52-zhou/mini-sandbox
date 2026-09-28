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
});
