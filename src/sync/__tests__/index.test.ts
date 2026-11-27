/** @jest-environment node */
jest.mock('server-only', () => ({}));

type RunOutcome = {
  runId: string;
  status: 'success' | 'error';
  stored: number;
  error?: string;
} | null;
type FakeService = { run: jest.Mock<Promise<RunOutcome>, []>; isRunning: () => boolean };
type SchedulerOpts = { run: () => Promise<void>; onError: (e: unknown) => void };

const interruptRunning = jest.fn(async () => undefined);
const lastSuccess = jest.fn(async () => undefined);
const createSyncService = jest.fn((): FakeService => ({
  run: jest.fn(async () => null),
  isRunning: () => false,
}));
const schedulerStart = jest.fn(async () => undefined);
const createScheduler = jest.fn<{ start: () => Promise<void>; stop: () => void }, [SchedulerOpts]>(
  () => ({ start: schedulerStart, stop: jest.fn() })
);

jest.mock('../../db', () => ({ getDb: jest.fn(async () => ({ fake: 'db' })) }));
jest.mock('../../db/repos/sync-run', () => ({
  syncRunRepo: () => ({ interruptRunning, lastSuccess }),
}));
jest.mock('../../garmin', () => ({ getGarminClient: () => ({ fake: 'client' }) }));
jest.mock('../scheduler', () => ({
  createScheduler: (o: SchedulerOpts) => createScheduler(o),
}));
jest.mock('../run', () => ({
  createSyncService: () => createSyncService(),
  describeError: (e: unknown) => (e instanceof Error ? e.message : 'unknown'),
}));

const KEY = Symbol.for('garminconnect.sync');

function resetSharedState() {
  Reflect.set(globalThis, KEY, undefined);
}

describe('sync index', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    resetSharedState();
  });

  it('builds the service once, after interrupting stale runs', async () => {
    const { getSyncService } = await import('../index');
    const a = await getSyncService();
    const b = await getSyncService();
    expect(b).toBe(a);
    expect(interruptRunning).toHaveBeenCalledTimes(1);
    expect(createSyncService).toHaveBeenCalledTimes(1);
  });

  it('clears the cached promise on failure so the next call retries', async () => {
    const { getSyncService } = await import('../index');
    interruptRunning.mockRejectedValueOnce(new Error('db down'));
    await expect(getSyncService()).rejects.toThrow('db down');
    await expect(getSyncService()).resolves.toBeDefined();
    expect(createSyncService).toHaveBeenCalledTimes(1);
  });

  it('starts the scheduler once per process', async () => {
    const { startSyncScheduler } = await import('../index');
    await startSyncScheduler();
    await startSyncScheduler();
    expect(createScheduler).toHaveBeenCalledTimes(1);
    expect(schedulerStart).toHaveBeenCalledTimes(1);
  });

  it('logs skip, error, success and scheduler failures', async () => {
    const { startSyncScheduler, getSyncService } = await import('../index');
    const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const error = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    await startSyncScheduler();
    const [opts] = createScheduler.mock.calls[0];
    const service = (await getSyncService()) as unknown as FakeService;

    service.run.mockResolvedValueOnce(null);
    await opts.run();
    expect(info).toHaveBeenCalledWith(expect.stringContaining('skipped'));

    service.run.mockResolvedValueOnce({ runId: 'r1', status: 'error', stored: 0, error: 'boom' });
    await opts.run();
    expect(error).toHaveBeenCalledWith(expect.stringContaining('boom'));

    service.run.mockResolvedValueOnce({ runId: 'r2', status: 'success', stored: 4 });
    await opts.run();
    expect(info).toHaveBeenCalledWith(expect.stringContaining('4 day-payloads'));

    opts.onError(new Error('network'));
    expect(error).toHaveBeenLastCalledWith('[sync] scheduled pull failed:', 'network');

    info.mockRestore();
    error.mockRestore();
  });
});
