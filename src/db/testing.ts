import { createDb } from './client';
import { runMigrations } from './migrate';

/** Fresh in-memory, fully migrated DB for tests. */
export async function createTestDb() {
  const db = await createDb(':memory:');
  await runMigrations(db);
  return db;
}
