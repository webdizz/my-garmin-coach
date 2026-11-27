/** @jest-environment node */
jest.mock('server-only', () => ({}));

const ORIGINAL = process.env.GARMIN_CONNECT_API_KEY;

describe('garmin index', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.GARMIN_CONNECT_API_KEY;
    else process.env.GARMIN_CONNECT_API_KEY = ORIGINAL;
  });

  it('reports whether the key is set without returning its value', async () => {
    const { hasGarminApiKey } = await import('../index');
    process.env.GARMIN_CONNECT_API_KEY = 'synthetic-key';
    expect(hasGarminApiKey()).toBe(true);
    delete process.env.GARMIN_CONNECT_API_KEY;
    expect(hasGarminApiKey()).toBe(false);
  });

  it('throws when building a client without the key', async () => {
    delete process.env.GARMIN_CONNECT_API_KEY;
    const { getGarminClient } = await import('../index');
    expect(() => getGarminClient()).toThrow('GARMIN_CONNECT_API_KEY is not set');
  });

  it('builds one process-wide client and reuses it', async () => {
    process.env.GARMIN_CONNECT_API_KEY = 'synthetic-key';
    const { getGarminClient } = await import('../index');
    const first = getGarminClient();
    expect(getGarminClient()).toBe(first);
  });
});
