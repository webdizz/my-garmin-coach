/** @jest-environment node */
import { createTestDb } from '../testing';
import { youProfileRepo, ProfileInputError } from '../repos/you-profile';

// Synthetic data only.
const DAY = '2030-03-10';

describe('youProfileRepo feeling', () => {
  it('overwrites the feeling for the same day', async () => {
    const repo = youProfileRepo(await createTestDb());
    await repo.setFeeling(DAY, 'tired');
    await repo.setFeeling(DAY, 'good');
    expect((await repo.feelingOn(DAY))?.feeling).toBe('good');
  });

  it('rejects an unknown feeling and a bad date', async () => {
    const repo = youProfileRepo(await createTestDb());
    await expect(repo.setFeeling(DAY, 'meh' as never)).rejects.toThrow(ProfileInputError);
    await expect(repo.setFeeling('2030-02-30', 'ok')).rejects.toThrow(ProfileInputError);
    await expect(repo.setFeeling('10-03-2030', 'ok')).rejects.toThrow(ProfileInputError);
  });
});

describe('youProfileRepo niggles', () => {
  it('adds a niggle and lists it as active', async () => {
    const repo = youProfileRepo(await createTestDb());
    const row = await repo.addNiggle({ label: 'Left calf', startedOn: DAY, severity: 2 });
    expect(row).toMatchObject({ label: 'Left calf', severity: 2, resolvedOn: null });
    expect(await repo.activeNiggles()).toHaveLength(1);
  });

  it('resolves a niggle once and drops it from the active list', async () => {
    const repo = youProfileRepo(await createTestDb());
    const row = await repo.addNiggle({ label: 'Knee', startedOn: DAY });
    expect(await repo.resolveNiggle(row.id, '2030-03-20')).toBe(true);
    expect(await repo.resolveNiggle(row.id, '2030-03-21')).toBe(false);
    expect(await repo.activeNiggles()).toEqual([]);
  });

  it('returns false for an unknown niggle id', async () => {
    const repo = youProfileRepo(await createTestDb());
    expect(await repo.resolveNiggle('01UNKNOWN0000000000000000X', DAY)).toBe(false);
  });

  it('defaults severity to 1 and rejects out-of-range severity', async () => {
    const repo = youProfileRepo(await createTestDb());
    expect((await repo.addNiggle({ label: 'Hip', startedOn: DAY })).severity).toBe(1);
    await expect(repo.addNiggle({ label: 'Hip', startedOn: DAY, severity: 9 })).rejects.toThrow(
      ProfileInputError
    );
    await expect(repo.addNiggle({ label: 'Hip', startedOn: DAY, severity: 1.5 })).rejects.toThrow(
      ProfileInputError
    );
  });

  it('rejects an empty or over-long label and trims whitespace', async () => {
    const repo = youProfileRepo(await createTestDb());
    await expect(repo.addNiggle({ label: '   ', startedOn: DAY })).rejects.toThrow('label');
    await expect(repo.addNiggle({ label: 'x'.repeat(121), startedOn: DAY })).rejects.toThrow(
      'at most 120'
    );
    await expect(repo.addNiggle({ label: 42, startedOn: DAY })).rejects.toThrow('string');
    expect((await repo.addNiggle({ label: '  Calf  ', startedOn: DAY })).label).toBe('Calf');
  });

  it('rejects an over-long note', async () => {
    const repo = youProfileRepo(await createTestDb());
    await expect(
      repo.addNiggle({ label: 'Calf', startedOn: DAY, note: 'x'.repeat(501) })
    ).rejects.toThrow('at most 500');
  });
});

describe('youProfileRepo goal', () => {
  it('keeps only one active goal', async () => {
    const repo = youProfileRepo(await createTestDb());
    await repo.setGoal({ event: 'Spring 10k', date: '2030-04-01' });
    await repo.setGoal({ event: 'Half marathon', date: '2030-10-12', target: 'sub 1:45' });
    expect(await repo.activeGoal()).toMatchObject({
      event: 'Half marathon',
      target: 'sub 1:45',
    });
  });

  it('returns undefined when no goal is set', async () => {
    expect(await youProfileRepo(await createTestDb()).activeGoal()).toBeUndefined();
  });

  it('rejects a missing event', async () => {
    await expect(
      youProfileRepo(await createTestDb()).setGoal({ event: '', date: DAY })
    ).rejects.toThrow('event is required');
  });
});

describe('youProfileRepo training slots', () => {
  it('lists slots ordered by weekday then start', async () => {
    const repo = youProfileRepo(await createTestDb());
    await repo.addSlot({ weekday: 7, start: '07:30', end: '10:00', kind: 'run' });
    await repo.addSlot({ weekday: 1, start: '18:00', end: '19:30', kind: 'run' });
    await repo.addSlot({ weekday: 1, start: '07:00', end: '07:45', kind: 'pool' });
    const slots = await repo.activeSlots();
    expect(slots.map((s) => [s.weekday, s.start])).toEqual([
      [1, '07:00'],
      [1, '18:00'],
      [7, '07:30'],
    ]);
  });

  it('rejects a bad weekday, a bad time and end before start', async () => {
    const repo = youProfileRepo(await createTestDb());
    const base = { start: '07:00', end: '08:00', kind: 'run' };
    await expect(repo.addSlot({ ...base, weekday: 0 })).rejects.toThrow('weekday');
    await expect(repo.addSlot({ ...base, weekday: 8 })).rejects.toThrow('weekday');
    await expect(repo.addSlot({ ...base, weekday: 2, start: '25:00' })).rejects.toThrow('start');
    await expect(repo.addSlot({ ...base, weekday: 2, end: '7:00' })).rejects.toThrow('end');
    await expect(repo.addSlot({ ...base, weekday: 2, end: '06:00' })).rejects.toThrow(
      'end must be after start'
    );
  });
});
