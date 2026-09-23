import { spawn } from 'node:child_process';

import type { CapturedOutput } from './captured-output.js';

export function executeCommand(command: string): Promise<CapturedOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        exitCode,
        signal,
      });
    });
  });
}
