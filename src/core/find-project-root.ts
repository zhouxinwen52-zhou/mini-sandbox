import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export function findProjectRoot(startDirectory: string): string {
  let currentDirectory = resolve(startDirectory);

  while (true) {
    if (existsSync(join(currentDirectory, '.git'))) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return resolve(startDirectory);
    }

    currentDirectory = parentDirectory;
  }
}
