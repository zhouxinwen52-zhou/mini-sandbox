import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { CapturedOutput } from './core/captured-output.js';
import { executeCommand } from './core/execute-command.js';
import type {
  QueryOutputInput,
  QueryOutputResult,
} from './core/query-output.js';
import { runCtxRun } from './core/run-ctx-run.js';
import type {
  StoredOutput,
  StoreOutputInput,
} from './core/store-output.js';

const ctxRunInputSchema = z.object({
  command: z.string().min(1),
});

const ctxQueryInputSchema = z.object({
  query: z.string().min(1),
  handle: z.string().min(1).optional(),
  limit: z.number().int().positive().optional(),
});

interface MiniSandboxServerDependencies {
  projectId: string;
  sessionId: string;
  emergencyPreviewBytes?: number;
  runCommand?: (command: string) => Promise<CapturedOutput>;
  storeOutput: (input: StoreOutputInput) => StoredOutput;
  queryOutput: (input: QueryOutputInput) => QueryOutputResult;
}

export function createMiniSandboxServer({
  projectId,
  sessionId,
  emergencyPreviewBytes = 2 * 1024,
  runCommand = executeCommand,
  storeOutput,
  queryOutput,
}: MiniSandboxServerDependencies): McpServer {
  const server = new McpServer({
    name: 'mini-sandbox',
    version: '0.1.0',
  });

  server.registerTool(
    'ctx_run',
    {
      description: 'Execute a command and store its complete output locally.',
      inputSchema: ctxRunInputSchema,
    },
    async ({ command }) => {
      const result = await runCtxRun(command, {
        projectId,
        sessionId,
        emergencyPreviewBytes,
        runCommand,
        storeOutput,
      });

      return {
        isError: result.isError,
        content: [
          {
            type: 'text',
            text: result.text,
          },
        ],
      };
    },
  );

  server.registerTool(
    'ctx_query',
    {
      description: 'Search stored output and return bounded relevant snippets.',
      inputSchema: ctxQueryInputSchema,
    },
    async ({ query, handle, limit }) => {
      const result = queryOutput({
        query,
        ...(handle === undefined ? {} : { handle }),
        ...(limit === undefined ? {} : { limit }),
      });

      return {
        content: [
          {
            type: 'text',
            text: result.text,
          },
        ],
      };
    },
  );

  return server;
}
