import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

import type { CapturedOutput } from './core/captured-output.js';
import { executeCommand } from './core/execute-command.js';
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
  runCommand?: (command: string) => Promise<CapturedOutput>;
  storeOutput: (input: StoreOutputInput) => StoredOutput;
}

export function createMiniSandboxServer({
  projectId,
  sessionId,
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
      const captured = await runCommand(command);
      const stored = storeOutput({
        projectId,
        sessionId,
        source: 'ctx_run',
        toolInput: command,
        rawOutput: captured.rawOutput,
        stdout: captured.stdout,
        stderr: captured.stderr,
        exitCode: captured.exitCode,
        signal: captured.signal,
      });

      return {
        content: [
          {
            type: 'text',
            text: [
              `handle: ${stored.handle}`,
              `bytes: ${stored.byteCount}`,
              `exitCode: ${captured.exitCode ?? 'null'}`,
              'preview:',
              stored.preview,
            ].join('\n'),
          },
        ],
      };
    },
  );

  return server;
}
