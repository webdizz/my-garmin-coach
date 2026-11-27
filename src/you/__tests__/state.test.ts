/** @jest-environment node */
import { createTestDb } from '@/db/testing';
import { youProfileRepo } from '@/db/repos/you-profile';
import { syncRunRepo } from '@/db/repos/sync-run';
import { localDay, getYouState } from '../state';

jest.mock('server-only', () => ({}));

// Synthetic data only.
const NOON = new Date(2030, 2, 10, 12, 0, 0); // local noon, so the day is unambiguous

describe('localDay', () => {
  it('formats the local calendar day as YYYY-MM-DD', () => {
    expect(localDay(NOON)).toBe('2030-03-10');
  });
});

describe('getYouState', () => {
  it('returns the empty state when nothing has been entered', async () => {
    const db = await createTestDb();
    const state = await getYouState(db, { running: false, garminKey: 'missing', now: NOON });
    expect(state).toMatchObject({
      today: '2030-03-10',
      feeling: null,
      niggles: [],
      goal: null,
      slots: [],
      garminKey: 'missing',
      sync: { state: 'never', lastSuccessAt: null },
    });
  });

  it('combines check-in, niggles, goal, slots and sync status', async () => {
    const db = await createTestDb();
    const repo = youProfileRepo(db);
    await repo.setFeeling('2030-03-10', 'good');
    await repo.addNiggle({ label: 'Left calf', startedOn: '2030-03-08', severity: 2 });
    await repo.setGoal({ event: 'Half marathon', date: '2030-10-12', target: 'sub 1:45' });
    await repo.addSlot({ weekday: 1, start: '18:00', end: '19:30', kind: 'run' });
    const run = await syncRunRepo(db).start('schedule');
    await syncRunRepo(db).finish(run.id);

    const state = await getYouState(db, { running: false, garminKey: 'configured', now: NOON });
    expect(state.feeling).toBe('good');
    expect(state.niggles).toEqual([
      expect.objectContaining({ label: 'Left calf', severity: 2, startedOn: '2030-03-08' }),
    ]);
    expect(state.goal).toEqual({ event: 'Half marathon', date: '2030-10-12', target: 'sub 1:45' });
    expect(state.slots).toEqual([expect.objectContaining({ weekday: 1, start: '18:00' })]);
    expect(state.sync.state).toBe('ok');
    expect(state.sync.lastSuccessAt).not.toBeNull();
    expect(state.garminKey).toBe('configured');
  });

  it('reports a failed last run as an error state', async () => {
    const db = await createTestDb();
    const run = await syncRunRepo(db).start('manual');
    await syncRunRepo(db).finish(run.id, { error: 'boom' });
    const state = await getYouState(db, { running: false, garminKey: 'configured', now: NOON });
    expect(state.sync.state).toBe('error');
  });

  it('reports running while a pull is in flight', async () => {
    const db = await createTestDb();
    const state = await getYouState(db, { running: true, garminKey: 'configured', now: NOON });
    expect(state.sync.state).toBe('running');
  });

  it('shows a feeling only for today, not yesterday', async () => {
    const db = await createTestDb();
    await youProfileRepo(db).setFeeling('2030-03-09', 'rough');
    const state = await getYouState(db, { running: false, garminKey: 'configured', now: NOON });
    expect(state.feeling).toBeNull();
  });
});
