/** @jest-environment node */
import { createTestDb } from '../../db/testing';
import { rawJsonRepo } from '../../db/repos/raw-json';
import { syncRunRepo } from '../../db/repos/sync-run';
import { GarminApiError, type GarminClient } from '../../garmin/client';
import { withBackoff } from '../backoff';
import { createScheduler } from '../scheduler';
import { createSyncService } from '../run';
import { nextSlot, previousSlot } from '../slots';
import { getSyncStatus } from '../status';

// Synthetic data only.
const NOW = new Date(2030, 0, 10, 12, 0);

function fakeClient(overrides: Partial<GarminClient> = {}): GarminClient {
  const unused = async () => {
    throw new Error('unexpected call');
  };
  return {
    hrvDay: unused,
    hrvRange: async () => ({ hrvSummaries: [] }),
    sleepRange: async (from) => [
      { calendarDate: `${from.getFullYear()}-01-08`, sleepTimeSeconds: 100 } as never,
    ],
    restingHeartRate: async (d) => ({ calendarDate: String(d), restingHeartRate: 50 }) as never,
    heartRateZones: async () => [],
    weightRange: async () => ({ dailyWeightSummaries: [] }),
    bodyBatteryRange: async () => [],
    stressRange: async () => [],
    dailySummary: async () => ({ totalSteps: 1 }) as never,
    fitnessAge: async () => ({ fitnessAge: 30 }) as never,
    vo2MaxRange: async () => [],
    activities: async () => [],
    ...overrides,
  };
}

const fast = { retries: 2, sleep: async () => {} };

describe('slots', () => {
  it('finds next and previous slot', () => {
    expect(nextSlot(NOW)).toEqual(new Date(2030, 0, 10, 18, 0));
    expect(nextSlot(new Date(2030, 0, 10, 23, 30))).toEqual(new Date(2030, 0, 11, 9, 30));
    expect(previousSlot(NOW)).toEqual(new Date(2030, 0, 10, 9, 30));
    expect(previousSlot(new Date(2030, 0, 10, 8, 0))).toEqual(new Date(2030, 0, 9, 23, 30));
  });
});

describe('withBackoff', () => {
  it('retries 429 then succeeds, doubling the delay', async () => {
    const delays: number[] = [];
    let n = 0;
    const out = await withBackoff(
      async () => {
        if (++n < 3) throw new GarminApiError(429, '/x');
        return 'ok';
      },
      { baseMs: 10, sleep: async (ms) => void delays.push(ms) }
    );
    expect(out).toBe('ok');
    expect(delays).toEqual([10, 20]);
  });

  it('does not retry a 400', async () => {
    let n = 0;
    await expect(
      withBackoff(async () => {
        n++;
        throw new GarminApiError(400, '/x');
      }, fast)
    ).rejects.toThrow();
    expect(n).toBe(1);
  });
});

describe('sync service', () => {
  it('is idempotent: re-running a day does not duplicate rows', async () => {
    const db = await createTestDb();
    const svc = createSyncService({ db, client: fakeClient(), now: () => NOW, retry: fast });
    const first = await svc.run('manual');
    const second = await svc.run('manual');
    expect(first?.status).toBe('success');
    expect(second?.status).toBe('success');
    const rows = await db.$client.execute('select count(*) c from raw_json');
    expect(Number(rows.rows[0].c)).toBe(first?.stored);
  });

  it('records an error run and keeps other kinds', async () => {
    const db = await createTestDb();
    const client = fakeClient({
      stressRange: async () => {
        throw new GarminApiError(500, '/stress');
      },
    });
    const out = await createSyncService({ db, client, now: () => NOW, retry: fast }).run(
      'schedule'
    );
    expect(out?.status).toBe('error');
    expect(out?.error).toContain('stress');
    expect(
      await rawJsonRepo(db).get({ source: 'garmin', kind: 'sleep', date: '2030-01-08' })
    ).toBeDefined();
    const status = await getSyncStatus(db, { running: false, now: NOW });
    expect(status.state).toBe('error');
    expect(status.lastSuccessAt).toBeNull();
  });

  it('stops after a 429 that exhausts retries', async () => {
    const db = await createTestDb();
    const dailySummary = jest.fn();
    const client = fakeClient({
      sleepRange: async () => {
        throw new GarminApiError(429, '/sleep');
      },
      dailySummary,
    });
    const out = await createSyncService({ db, client, now: () => NOW, retry: fast }).run('manual');
    expect(out?.status).toBe('error');
    expect(dailySummary).not.toHaveBeenCalled();
  });

  it('skips a second run while one is in flight', async () => {
    const db = await createTestDb();
    let release: () => void = () => {};
    const gate = new Promise<void>((r) => (release = r));
    const client = fakeClient({ sleepRange: async () => (await gate, []) });
    const svc = createSyncService({ db, client, now: () => NOW, retry: fast });
    const a = svc.run('manual');
    expect(svc.isRunning()).toBe(true);
    expect(await svc.run('manual')).toBeNull();
    release();
    await a;
    expect(svc.isRunning()).toBe(false);
  });

  it('chunks long backfills into windows of at most 90 days', async () => {
    const db = await createTestDb();
    const spans: number[] = [];
    const client = fakeClient({
      sleepRange: async (from, to) => {
        spans.push(Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
        return [];
      },
    });
    await createSyncService({ db, client, now: () => NOW, retry: fast }).run('manual', {
      days: 200,
    });
    expect(spans).toEqual([90, 90, 20]);
  });

  it('rejects an out-of-range days value', async () => {
    const svc = createSyncService({
      db: await createTestDb(),
      client: fakeClient(),
      now: () => NOW,
    });
    await expect(svc.run('manual', { days: 0 })).rejects.toThrow(RangeError);
  });
});

describe('interruptRunning', () => {
  it('fails runs left running by a restart', async () => {
    const db = await createTestDb();
    const runs = syncRunRepo(db);
    await runs.start('manual');
    await runs.interruptRunning();
    expect((await runs.latest())?.status).toBe('error');
  });
});

describe('scheduler', () => {
  it('catches up on start when the last slot was missed, then arms the next slot', async () => {
    const run = jest.fn(async () => {});
    const delays: number[] = [];
    const s = createScheduler({
      run,
      lastSuccessAt: async () => new Date(2030, 0, 9, 10, 0),
      now: () => NOW,
      setTimer: (_fn, ms) => void delays.push(ms),
      clearTimer: () => {},
    });
    await s.start();
    expect(run).toHaveBeenCalledTimes(1);
    expect(delays).toEqual([6 * 3600_000]);
    s.stop();
  });

  it('does not catch up when a pull succeeded after the last slot', async () => {
    const run = jest.fn(async () => {});
    const s = createScheduler({
      run,
      lastSuccessAt: async () => new Date(2030, 0, 10, 10, 0),
      now: () => NOW,
      setTimer: () => 0,
      clearTimer: () => {},
    });
    await s.start();
    expect(run).not.toHaveBeenCalled();
  });
});
