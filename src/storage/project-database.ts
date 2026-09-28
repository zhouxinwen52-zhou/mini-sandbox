import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import Database from 'better-sqlite3';

export interface ProjectDatabase {
  database: Database.Database;
  projectId: string;
  path: string;
}

export function openProjectDatabase(
  dataDirectory: string,
  projectRoot: string,
): ProjectDatabase {
  const normalizedProjectRoot = resolve(projectRoot);
  const projectId = createHash('sha256')
    .update(normalizedProjectRoot)
    .digest('hex');
  const projectDirectory = join(dataDirectory, 'projects', projectId);
  const path = join(projectDirectory, 'mini-sandbox.db');

  mkdirSync(projectDirectory, { recursive: true });

  return {
    database: new Database(path),
    projectId,
    path,
  };
}
