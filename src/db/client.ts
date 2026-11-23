import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Db = Awaited<ReturnType<typeof createDb>>;

/** Filesystem path for a `file:` URL, or undefined for non-file URLs (`:memory:`, `libsql:`, ...). */
function filePathOf(url: string): string | undefined {
  if (!url.startsWith('file:') || url.startsWith('file::memory:')) return undefined;
  return url.startsWith('file://') ? fileURLToPath(url) : url.slice('file:'.length);
}

/**
 * Create a Drizzle client. `url` is a libsql URL: `file:./data/app.db` or `:memory:`.
 * Creates the parent directory of a file DB (libsql does not) and applies PRAGMAs before returning.
 */
export async function createDb(url: string, authToken?: string) {
  const filePath = filePathOf(url);
  if (filePath) fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });

  const client = createClient({ url, authToken });
  if (filePath) {
    // WAL keeps readers unblocked during sync writes.
    await client.execute('PRAGMA journal_mode = WAL');
  }
  // Foreign keys are off by default in SQLite.
  await client.execute('PRAGMA foreign_keys = ON');
  return drizzle(client, { schema });
}
