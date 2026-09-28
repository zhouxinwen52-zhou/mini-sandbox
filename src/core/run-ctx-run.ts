import type { CapturedOutput } from './captured-output.js';
import { createOutputPreview } from './output-preview.js';
import type {
  StoredOutput,
  StoreOutputInput,
} from './store-output.js';

export interface RunCtxRunDependencies {
  projectId: string;
  sessionId: string;
  emergencyPreviewBytes: number;
  runCommand: (command: string) => Promise<CapturedOutput>;
  storeOutput: (input: StoreOutputInput) => StoredOutput;
}

export interface RunCtxRunResult {
  isError: boolean;
  text: string;
  preview: string;
}

export async function runCtxRun(
  command: string,
  dependencies: RunCtxRunDependencies,
): Promise<RunCtxRunResult> {
  const captured = await dependencies.runCommand(command);

  try {
    const stored = dependencies.storeOutput({
      projectId: dependencies.projectId,
      sessionId: dependencies.sessionId,
      source: 'ctx_run',
      toolInput: command,
      rawOutput: captured.rawOutput,
      stdout: captured.stdout,
      stderr: captured.stderr,
      exitCode: captured.exitCode,
      signal: captured.signal,
    });
    const text = [
      `handle: ${stored.handle}`,
      `bytes: ${stored.byteCount}`,
      `exitCode: ${captured.exitCode ?? 'null'}`,
      'preview:',
      stored.preview,
    ].join('\n');

    return { isError: false, text, preview: stored.preview };
  } catch {
    const emergencyPreview = createOutputPreview(
      captured.rawOutput,
      dependencies.emergencyPreviewBytes,
    );
    const text = [
      'storage failed; output was not persisted',
      `exitCode: ${captured.exitCode ?? 'null'}`,
      'emergency preview:',
      emergencyPreview.text,
    ].join('\n');

    return { isError: true, text, preview: emergencyPreview.text };
  }
}
