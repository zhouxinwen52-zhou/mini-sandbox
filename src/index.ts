import { randomUUID } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { serveStdio } from '@modelcontextprotocol/server/stdio';

import { loadConfig } from './config/config.js';
import { findProjectRoot } from './core/find-project-root.js';
import { createQueryOutput } from './core/query-output.js';
import { createStoreOutput } from './core/store-output.js';
import { createMiniSandboxServer } from './server.js';
import { openProjectDatabase } from './storage/project-database.js';
import { SqliteOutputStore } from './storage/sqlite-output-store.js';

const dataDirectory =
  process.env.MINI_SANDBOX_DATA_DIR ?? join(homedir(), '.mini-sandbox');
const sessionId =
  process.env.MINI_SANDBOX_SESSION_ID ?? `session_${randomUUID()}`;
const config = loadConfig();
const projectRoot = findProjectRoot(process.cwd());
const project = openProjectDatabase(dataDirectory, projectRoot);
const store = new SqliteOutputStore(project.database);
const storeOutput = createStoreOutput({
  store,
  previewBytes: config.previewBytes,
});
const queryOutput = createQueryOutput({
  projectId: project.projectId,
  sessionId,
  queryBudgetBytes: config.queryBudgetBytes,
  search: (input) => store.search(input),
});

serveStdio(() =>
  createMiniSandboxServer({
    projectId: project.projectId,
    sessionId,
    storeOutput,
    queryOutput,
  }),
);
