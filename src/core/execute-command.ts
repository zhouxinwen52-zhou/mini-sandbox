import { spawn } from 'node:child_process';

import type { CapturedOutput } from './captured-output.js';

export interface ExecuteCommandOptions {
  shell?: string;
}

export function executeCommand(
  command: string,
  { shell = process.env.SHELL }: ExecuteCommandOptions = {},
): Promise<CapturedOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, {
      shell: shell ?? true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const rawOutputChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
      rawOutputChunks.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
      rawOutputChunks.push(chunk);
    });
    child.on('error', reject);
    child.on('close', (exitCode, signal) => {
      resolve({
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        rawOutput: Buffer.concat(rawOutputChunks).toString('utf8'),
        exitCode,
        signal,
      });
    });
  });
}
