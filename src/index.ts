import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { createStoreOutput } from './core/store-output.js';
import { createMiniSandboxServer } from './server.js';
import { openProjectDatabase } from './storage/project-database.js';
import { SqliteOutputStore } from './storage/sqlite-output-store.js';

const dataDirectory =
  process.env.MINI_SANDBOX_DATA_DIR ?? join(homedir(), '.mini-sandbox');
const sessionId =
  process.env.MINI_SANDBOX_SESSION_ID ?? `session_${randomUUID()}`;
const project = openProjectDatabase(dataDirectory, process.cwd());
const store = new SqliteOutputStore(project.database);
const storeOutput = createStoreOutput({ store, previewBytes: 2 * 1024 });

serveStdio(() =>
  createMiniSandboxServer({
    projectId: project.projectId,
    sessionId,
    storeOutput,
  }),
);
