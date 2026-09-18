import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';

const ctxRunInputSchema = z.object({
  command: z.string().min(1),
});

export function createMiniSandboxServer(): McpServer {
  const server = new McpServer({
    name: 'mini-sandbox',
    version: '0.1.0',
  });

  server.registerTool(
    'ctx_run',
    {
      description: 'Register a command for MiniSandbox execution (Day 1 placeholder).',
      inputSchema: ctxRunInputSchema,
    },
    async () => ({
      content: [
        {
          type: 'text',
          text: 'ctx_run is registered; command execution starts on Day 2.',
        },
      ],
    }),
  );

  return server;
}
