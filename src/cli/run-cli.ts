import type { SqliteOutputStore } from '../storage/sqlite-output-store.js';

type StatsStore = Pick<SqliteOutputStore, 'stats'>;

export function runCli(args: string[], store: StatsStore): string {
  if (args.length !== 1 || args[0] !== 'stats') {
    throw new Error('Usage: mini-sandbox stats|purge|reindex');
  }

  return JSON.stringify(store.stats(), null, 2);
}
