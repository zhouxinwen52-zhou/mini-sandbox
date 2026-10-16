#!/usr/bin/env node

import { homedir } from 'node:os';
import { join } from 'node:path';

import { runCli } from './cli/run-cli.js';
import { findProjectRoot } from './core/find-project-root.js';
import { openProjectDatabase } from './storage/project-database.js';
import { SqliteOutputStore } from './storage/sqlite-output-store.js';

const dataDirectory =
  process.env.MINI_SANDBOX_DATA_DIR ?? join(homedir(), '.mini-sandbox');
const projectRoot = findProjectRoot(process.cwd());
const project = openProjectDatabase(dataDirectory, projectRoot);

try {
  const output = runCli(
    process.argv.slice(2),
    new SqliteOutputStore(project.database),
  );
  process.stdout.write(`${output}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
} finally {
  project.database.close();
}
