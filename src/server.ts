import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { CapturedOutput } from './core/captured-output.js';
import { executeCommand } from './core/execute-command.js';
import { runCtxRun } from './core/run-ctx-run.js';
import type {
  StoredOutput,
  StoreOutputInput,
} from './core/store-output.js';

const ctxRunInputSchema = z.object({
  command: z.string().min(1),
});

interface MiniSandboxServerDependencies {
  projectId: string;
  sessionId: string;
  emergencyPreviewBytes?: number;
  runCommand?: (command: string) => Promise<CapturedOutput>;
  storeOutput: (input: StoreOutputInput) => StoredOutput;
}

export function createMiniSandboxServer({
  projectId,
  sessionId,
  emergencyPreviewBytes = 2 * 1024,
  runCommand = executeCommand,
  storeOutput,
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

  return server;
}
