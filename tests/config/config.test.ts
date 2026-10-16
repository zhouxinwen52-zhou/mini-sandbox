import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { loadConfig } from '../../src/config/config.js';

describe('loadConfig', () => {
  test('uses defaults when the configuration file does not exist', () => {
    const config = loadConfig(join('/missing', 'config.json'));

    expect(config).toEqual({
      thresholdBytes: 10 * 1024,
      previewBytes: 2 * 1024,
      queryBudgetBytes: 4 * 1024,
    });
  });

  test('merges configured values with defaults', () => {
    const directory = mkdtempSync(join(tmpdir(), 'mini-sandbox-config-'));
    const path = join(directory, 'config.json');
    writeFileSync(path, JSON.stringify({ previewBytes: 1024 }));

    expect(loadConfig(path)).toEqual({
      thresholdBytes: 10 * 1024,
      previewBytes: 1024,
      queryBudgetBytes: 4 * 1024,
    });

    rmSync(directory, { recursive: true, force: true });
  });

  test.each([
    ['thresholdBytes', { thresholdBytes: 0 }],
    ['previewBytes', { thresholdBytes: 1024, previewBytes: 1024 }],
    ['queryBudgetBytes', { queryBudgetBytes: 1.5 }],
  ])('identifies an invalid %s field', (field, contents) => {
    const directory = mkdtempSync(join(tmpdir(), 'mini-sandbox-config-'));
    const path = join(directory, 'config.json');
    writeFileSync(path, JSON.stringify(contents));

    expect(() => loadConfig(path)).toThrow(new RegExp(field));

    rmSync(directory, { recursive: true, force: true });
  });
});
