/** @jest-environment node */
const startSyncScheduler = jest.fn(async () => undefined);
const hasGarminApiKey = jest.fn(() => true);

jest.mock('../garmin', () => ({ hasGarminApiKey: () => hasGarminApiKey() }));
jest.mock('../sync', () => ({ startSyncScheduler: () => startSyncScheduler() }));

const ORIGINAL_RUNTIME = process.env.NEXT_RUNTIME;

describe('instrumentation register', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hasGarminApiKey.mockReturnValue(true);
  });

  afterAll(() => {
    if (ORIGINAL_RUNTIME === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = ORIGINAL_RUNTIME;
  });

  it('does nothing outside the Node runtime', async () => {
    process.env.NEXT_RUNTIME = 'edge';
    const { register } = await import('../instrumentation');
    await register();
    expect(startSyncScheduler).not.toHaveBeenCalled();
  });

  it('starts the scheduler when the Node runtime has a key', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    const { register } = await import('../instrumentation');
    await register();
    expect(startSyncScheduler).toHaveBeenCalledTimes(1);
  });

  it('skips the scheduler and warns when no Garmin key is set', async () => {
    process.env.NEXT_RUNTIME = 'nodejs';
    hasGarminApiKey.mockReturnValue(false);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { register } = await import('../instrumentation');
    await register();
    expect(startSyncScheduler).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('scheduler not started'));
    warn.mockRestore();
  });
});
