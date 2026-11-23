/** @jest-environment node */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createDb } from '../client';
import { runMigrations } from '../migrate';
import { syncRunRepo } from '../repos/sync-run';
import { createTestDb } from '../testing';

describe('createDb', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gc-db-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('creates missing parent directories for a file: URL (fresh clone)', async () => {
    const file = path.join(dir, 'nested', 'data', 'app.db');
    const db = await createDb(`file:${file}`);
    await runMigrations(db);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('enables WAL and foreign keys before returning', async () => {
    const db = await createDb(`file:${path.join(dir, 'app.db')}`);
    const mode = await db.$client.execute('PRAGMA journal_mode');
    const fk = await db.$client.execute('PRAGMA foreign_keys');
    expect(mode.rows[0]?.journal_mode).toBe('wal');
    expect(fk.rows[0]?.foreign_keys).toBe(1);
  });
});

describe('syncRunRepo.finish', () => {
  it('treats an empty error string as an error', async () => {
    const repo = syncRunRepo(await createTestDb());
    const run = await repo.start('manual');
    await repo.finish(run.id, { error: '' });
    expect((await repo.latest())?.status).toBe('error');
  });
});
