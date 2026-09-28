import { randomUUID } from 'node:crypto';

import type { OutputStore } from './output-record.js';
import { createOutputPreview } from './output-preview.js';
import { utf8ByteLength } from './utf8-byte-length.js';

export interface StoreOutputInput {
  projectId: string;
  sessionId: string;
  source: string;
  toolInput: string;
  rawOutput: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}

export interface StoredOutput {
  handle: string;
  preview: string;
  truncated: boolean;
  byteCount: number;
}

interface StoreOutputDependencies {
  store: OutputStore;
  previewBytes: number;
  createHandle?: () => string;
  now?: () => Date;
}

export function createStoreOutput({
  store,
  previewBytes,
  createHandle = () => `out_${randomUUID()}`,
  now = () => new Date(),
}: StoreOutputDependencies): (input: StoreOutputInput) => StoredOutput {
  return (input) => {
    const handle = createHandle();
    const byteCount = utf8ByteLength(input.rawOutput);
    const preview = createOutputPreview(input.rawOutput, previewBytes);

    store.save({
      ...input,
      handle,
      byteCount,
      createdAt: now().toISOString(),
    });

    return {
      handle,
      preview: preview.text,
      truncated: preview.truncated,
      byteCount,
    };
  };
}
