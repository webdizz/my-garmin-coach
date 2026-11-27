import path from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import type { Db } from './client';

const MIGRATIONS_FOLDER = path.join(process.cwd(), 'drizzle');

export function runMigrations(db: Db) {
  return migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
