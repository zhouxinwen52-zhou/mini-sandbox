import { spawnSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGINAL_BYTES = 64 * 1024;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporaryHome = mkdtempSync(
  join(tmpdir(), 'mini-sandbox-byte-benchmark-'),
);
const configDirectory = join(temporaryHome, '.mini-sandbox');

try {
  mkdirSync(configDirectory);
  writeFileSync(
    join(configDirectory, 'config.json'),
    JSON.stringify({
      thresholdBytes: 1024,
      previewBytes: 256,
      queryBudgetBytes: 4096,
    }),
  );

  const command = `node -e 'process.stdout.write("x".repeat(${ORIGINAL_BYTES}))'`;
  const wrapper = spawnSync(
    process.execPath,
    [
      join(repositoryRoot, 'dist', 'codex', 'bash-wrapper.js'),
      '--command-base64',
      Buffer.from(command, 'utf8').toString('base64'),
    ],
    {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        HOME: temporaryHome,
        MINI_SANDBOX_DATA_DIR: join(temporaryHome, 'data'),
        MINI_SANDBOX_SESSION_ID: 'day10-byte-benchmark',
      },
    },
  );

  if (wrapper.status !== 0) {
    throw new Error(wrapper.stderr || `wrapper exited with ${wrapper.status}`);
  }

  const stored = JSON.parse(wrapper.stdout);
  if (
    typeof stored.handle !== 'string' ||
    stored.byteCount !== ORIGINAL_BYTES ||
    stored.truncated !== true
  ) {
    throw new Error('wrapper did not return the expected stored-output result');
  }

  const modelVisibleBytes = Buffer.byteLength(wrapper.stdout, 'utf8');
  const savedBytes = ORIGINAL_BYTES - modelVisibleBytes;

  process.stdout.write(
    `${JSON.stringify(
      {
        originalBytes: ORIGINAL_BYTES,
        modelVisibleBytes,
        savedBytes,
        savingsPercent: Number(
          ((savedBytes / ORIGINAL_BYTES) * 100).toFixed(2),
        ),
        handle: stored.handle,
      },
      null,
      2,
    )}\n`,
  );
} finally {
  rmSync(temporaryHome, { recursive: true, force: true });
}
