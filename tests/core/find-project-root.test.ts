import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { findProjectRoot } from '../../src/core/find-project-root.js';

describe('findProjectRoot', () => {
  test('returns the nearest ancestor containing a Git marker', () => {
    const outer = mkdtempSync(join(tmpdir(), 'mini-sandbox-project-'));
    const project = join(outer, 'project');
    const nested = join(project, 'packages', 'worker');
    mkdirSync(join(outer, '.git'));
    mkdirSync(join(project, '.git'), { recursive: true });
    mkdirSync(nested, { recursive: true });

    expect(findProjectRoot(nested)).toBe(project);

    rmSync(outer, { recursive: true, force: true });
  });

  test('uses the starting directory outside a Git repository', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mini-sandbox-project-'));
    const nested = join(directory, 'plain', 'directory');
    mkdirSync(nested, { recursive: true });

    expect(findProjectRoot(nested)).toBe(nested);

    rmSync(directory, { recursive: true, force: true });
  });
});
