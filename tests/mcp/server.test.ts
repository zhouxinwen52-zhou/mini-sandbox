import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/client';
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from '@modelcontextprotocol/client/stdio';
import { afterEach, describe, expect, test } from 'vitest';

import { openProjectDatabase } from '../../src/storage/project-database.js';
import { SqliteOutputStore } from '../../src/storage/sqlite-output-store.js';

const serverEntry = fileURLToPath(new URL('../../src/index.ts', import.meta.url));

let client: Client | undefined;
let dataDirectory: string | undefined;

async function connectClient(): Promise<Client> {
  dataDirectory = mkdtempSync(join(tmpdir(), 'mini-sandbox-mcp-'));
  client = new Client({ name: 'mini-sandbox-test-client', version: '0.1.0' });

  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', serverEntry],
      env: {
        ...getDefaultEnvironment(),
        MINI_SANDBOX_DATA_DIR: dataDirectory,
        MINI_SANDBOX_SESSION_ID: 'mcp-test-session',
      },
      stderr: 'pipe',
    }),
  );

  return client;
}

afterEach(async () => {
  await client?.close();
  client = undefined;
  if (dataDirectory !== undefined) {
    rmSync(dataDirectory, { recursive: true, force: true });
    dataDirectory = undefined;
  }
});

describe('MiniSandbox MCP server', () => {
  test('registers only the ctx_run tool after initialization', async () => {
    const connectedClient = await connectClient();

    const { tools } = await connectedClient.listTools();

    expect(tools.map((tool) => tool.name)).toEqual(['ctx_run']);
    expect(tools[0]?.inputSchema).toMatchObject({
      type: 'object',
      required: ['command'],
      properties: {
        command: { type: 'string' },
      },
    });
  });

  test('executes and stores a valid ctx_run call', async () => {
    const connectedClient = await connectClient();

    const result = await connectedClient.callTool({
      name: 'ctx_run',
      arguments: { command: 'printf hello' },
    });

    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringMatching(
          /^handle: out_[0-9a-f-]+\nbytes: 5\nexitCode: 0\npreview:\nhello$/,
        ),
      },
    ]);
  });

  test('stores stderr and exit metadata from a failed command', async () => {
    const connectedClient = await connectClient();
    const command = `${process.execPath} -e "process.stderr.write('boom'); process.exit(7)"`;

    const result = await connectedClient.callTool({
      name: 'ctx_run',
      arguments: { command },
    });

    expect(result.isError).not.toBe(true);
    const firstContent = result.content[0];
    expect(firstContent?.type).toBe('text');
    if (firstContent?.type !== 'text') {
      throw new Error('ctx_run did not return text content');
    }

    expect(firstContent.text).toMatch(
      /^handle: out_[0-9a-f-]+\nbytes: 4\nexitCode: 7\npreview:\nboom$/,
    );
    const handle = firstContent.text.match(/^handle: (out_[0-9a-f-]+)/)?.[1];
    expect(handle).toBeDefined();

    const project = openProjectDatabase(dataDirectory!, process.cwd());
    const store = new SqliteOutputStore(project.database);
    expect(store.findByHandle(handle!)).toMatchObject({
      handle,
      source: 'ctx_run',
      toolInput: command,
      rawOutput: 'boom',
      stdout: '',
      stderr: 'boom',
      exitCode: 7,
      signal: null,
    });
    project.database.close();
  });

  test('returns a tool error when ctx_run arguments violate the schema', async () => {
    const connectedClient = await connectClient();

    const result = await connectedClient.callTool({
      name: 'ctx_run',
      arguments: { command: 42 },
    });

    expect(result.isError).toBe(true);
  });
});
