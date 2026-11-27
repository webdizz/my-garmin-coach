/** @jest-environment node */
import { createTestDb } from '../testing';
import { rawJsonRepo } from '../repos/raw-json';
import { settingsRepo } from '../repos/settings';
import { syncRunRepo } from '../repos/sync-run';

// Synthetic data only.
const key = { source: 'garmin', kind: 'sleep', date: '2030-01-01' };

describe('migrations', () => {
  it('apply on an empty in-memory DB', async () => {
    const db = await createTestDb();
    const res = await db.$client.execute("select name from sqlite_master where type='table'");
    const names = res.rows.map((r) => r.name);
    expect(names).toEqual(expect.arrayContaining(['raw_json', 'sync_run', 'settings']));
  });
});

describe('rawJsonRepo', () => {
  it('overwrites the same (source, kind, date) on re-pull', async () => {
    const repo = rawJsonRepo(await createTestDb());
    await repo.upsert(key, { score: 70 });
    await repo.upsert(key, { score: 82 });
    const row = await repo.get(key);
    expect(row?.payload).toEqual({ score: 82 });
    expect(row?.id).toHaveLength(26);
    expect(await repo.range('garmin', 'sleep', '2030-01-01', '2030-01-31')).toHaveLength(1);
  });

  it('returns an inclusive, ordered range', async () => {
    const repo = rawJsonRepo(await createTestDb());
    for (const date of ['2030-01-03', '2030-01-01', '2030-01-02', '2030-02-01']) {
      await repo.upsert({ ...key, date }, { date });
    }
    const rows = await repo.range('garmin', 'sleep', '2030-01-01', '2030-01-03');
    expect(rows.map((r) => r.date)).toEqual(['2030-01-01', '2030-01-02', '2030-01-03']);
  });

  it('returns undefined for a missing day', async () => {
    expect(await rawJsonRepo(await createTestDb()).get(key)).toBeUndefined();
  });
});

describe('syncRunRepo', () => {
  it('tracks a run from start to success and error', async () => {
    const repo = syncRunRepo(await createTestDb());
    const a = await repo.start('manual');
    expect(a.status).toBe('running');
    await repo.finish(a.id);
    expect((await repo.latest())?.status).toBe('success');

    const b = await repo.start('schedule');
    await repo.finish(b.id, { error: 'boom' });
    const latest = await repo.latest();
    expect(latest).toMatchObject({ id: b.id, status: 'error', error: 'boom' });
    expect(latest?.finishedAt).toBeInstanceOf(Date);
  });
});

describe('settingsRepo', () => {
  it('sets, overwrites, reads and deletes typed values', async () => {
    const repo = settingsRepo(await createTestDb());
    expect(await repo.get('units')).toBeUndefined();
    await repo.set('units', 'metric');
    await repo.set('units', 'imperial');
    await repo.set('sync.hour', 7);
    expect(await repo.get('units')).toBe('imperial');
    expect(await repo.get('sync.hour')).toBe(7);
    await repo.delete('units');
    expect(await repo.get('units')).toBeUndefined();
  });

  it('counts the consecutive newest keyInvalid failures', async () => {
    const repo = syncRunRepo(await createTestDb());
    const fail = async (errorCode?: 'keyInvalid') => {
      const run = await repo.start('schedule');
      await repo.finish(run.id, errorCode ? { error: 'x', errorCode } : { error: 'other' });
    };
    await fail('keyInvalid');
    await fail('keyInvalid');
    expect((await repo.keyInvalidStreak()).count).toBe(2);
    await fail();
    // Intended: any other failure (network, 5xx) ends the streak and resets the backoff.
    expect((await repo.keyInvalidStreak()).count).toBe(0);
    const ok = await repo.start('manual');
    await repo.finish(ok.id);
    await fail('keyInvalid');
    expect((await repo.keyInvalidStreak()).count).toBe(1);
  });
});
