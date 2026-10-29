import { spawnSync } from 'node:child_process';

import { describe, expect, test } from 'vitest';

interface BenchmarkResult {
  originalBytes: number;
  modelVisibleBytes: number;
  savedBytes: number;
  savingsPercent: number;
  handle: string;
}

describe('byte-savings benchmark', () => {
  test('measures the real wrapper response against deterministic large output', () => {
    const result = spawnSync('npm', ['run', '--silent', 'benchmark:bytes'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(result.status, result.stderr || result.stdout).toBe(0);

    const benchmark = JSON.parse(result.stdout) as BenchmarkResult;
    expect(benchmark.originalBytes).toBe(64 * 1024);
    expect(benchmark.modelVisibleBytes).toBeLessThan(1024);
    expect(benchmark.savedBytes).toBe(
      benchmark.originalBytes - benchmark.modelVisibleBytes,
    );
    expect(benchmark.savingsPercent).toBeGreaterThan(98);
    expect(benchmark.handle).toMatch(/^out_/);
  });
});
