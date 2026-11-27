/** @jest-environment node */
import { createTestDb } from '@/db/testing';
import { youProfileRepo } from '@/db/repos/you-profile';
import { syncRunRepo } from '@/db/repos/sync-run';
import { getYouState } from '@/you/state';

// Synthetic data only. Checks the loader render inputs the page relies on.
jest.mock('server-only', () => ({}));

describe('You screen render states', () => {
  const now = new Date(2030, 2, 10, 12, 0, 0);

  it('no sync yet: state never, no last pull', async () => {
    const state = await getYouState(await createTestDb(), {
      running: false,
      garminKey: 'configured',
      now,
    });
    expect(state.sync.state).toBe('never');
    expect(state.sync.lastSuccessAt).toBeNull();
  });

  it('last run failed: state error', async () => {
    const db = await createTestDb();
    const run = await syncRunRepo(db).start('schedule');
    await syncRunRepo(db).finish(run.id, { error: 'timeout' });
    expect(
      (await getYouState(db, { running: false, garminKey: 'configured', now })).sync.state
    ).toBe('error');
  });

  it('key missing is passed through unchanged', async () => {
    const state = await getYouState(await createTestDb(), {
      running: false,
      garminKey: 'missing',
      now,
    });
    expect(state.garminKey).toBe('missing');
  });

  it('no niggles: empty list', async () => {
    const state = await getYouState(await createTestDb(), {
      running: false,
      garminKey: 'configured',
      now,
    });
    expect(state.niggles).toEqual([]);
  });

  it('resolved niggles do not appear', async () => {
    const db = await createTestDb();
    const repo = youProfileRepo(db);
    const n = await repo.addNiggle({ label: 'Hip', startedOn: '2030-03-01' });
    await repo.resolveNiggle(n.id, '2030-03-05');
    expect(
      (await getYouState(db, { running: false, garminKey: 'configured', now })).niggles
    ).toEqual([]);
  });
});
