import type { SqliteOutputStore } from '../storage/sqlite-output-store.js';

type MaintenanceStore = Pick<
  SqliteOutputStore,
  'purge' | 'reindex' | 'stats'
>;

export function runCli(args: string[], store: MaintenanceStore): string {
  if (args.length !== 1) {
    throw new Error('Usage: mini-sandbox stats|purge|reindex');
  }

  if (args[0] === 'stats') {
    return JSON.stringify(store.stats(), null, 2);
  }

  if (args[0] === 'purge') {
    store.purge();
    return 'Purged stored outputs.';
  }

  if (args[0] === 'reindex') {
    store.reindex();
    return 'Reindexed stored outputs.';
  }

  throw new Error('Usage: mini-sandbox stats|purge|reindex');
}
