import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import * as z from 'zod/v4';

export interface MiniSandboxConfig {
  thresholdBytes: number;
  previewBytes: number;
  queryBudgetBytes: number;
}

const DEFAULT_CONFIG: MiniSandboxConfig = {
  thresholdBytes: 10 * 1024,
  previewBytes: 2 * 1024,
  queryBudgetBytes: 4 * 1024,
};

const positiveByteCount = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const configShape = {
  thresholdBytes: positiveByteCount,
  previewBytes: positiveByteCount,
  queryBudgetBytes: positiveByteCount,
};
const configFileSchema = z.strictObject({
  thresholdBytes: positiveByteCount.optional(),
  previewBytes: positiveByteCount.optional(),
  queryBudgetBytes: positiveByteCount.optional(),
});
const configSchema = z
  .strictObject(configShape)
  .refine((config) => config.previewBytes < config.thresholdBytes, {
    message: 'must be less than thresholdBytes',
    path: ['previewBytes'],
  });

export function loadConfig(
  path = join(homedir(), '.mini-sandbox', 'config.json'),
): MiniSandboxConfig {
  let contents: string;

  try {
    contents = readFileSync(path, 'utf8');
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return { ...DEFAULT_CONFIG };
    }

    throw error;
  }

  const fileResult = configFileSchema.safeParse(JSON.parse(contents) as unknown);

  if (!fileResult.success) {
    throw invalidConfigurationError(fileResult.error);
  }

  const result = configSchema.safeParse({
    ...DEFAULT_CONFIG,
    ...fileResult.data,
  });

  if (!result.success) {
    throw invalidConfigurationError(result.error);
  }

  return result.data;
}

function invalidConfigurationError(error: z.ZodError): Error {
  const details = error.issues
    .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
    .join('; ');
  return new Error(`Invalid configuration: ${details}`);
}
