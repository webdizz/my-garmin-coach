import 'server-only';
import { createDb, type Db } from './client';
import { runMigrations } from './migrate';

let ready: Promise<Db> | undefined;

/** Process-wide DB, migrated on first use. Server-only. Path from DATABASE_URL (default `file:./data/app.db`). */
export function getDb(): Promise<Db> {
  ready ??= (async () => {
    const db = await createDb(
      process.env.DATABASE_URL ?? 'file:./data/app.db',
      process.env.DATABASE_AUTH_TOKEN
    );
    await runMigrations(db);
    return db;
  })();
  return ready;
}
