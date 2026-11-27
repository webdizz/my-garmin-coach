/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('../client', () => {
  const actual = jest.requireActual<typeof import('../client')>('../client');
  return { ...actual, createDb: jest.fn(actual.createDb) };
});

describe('getDb', () => {
  const ORIGINAL_URL = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.DATABASE_URL = 'file::memory:';
  });

  afterAll(() => {
    if (ORIGINAL_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL_URL;
  });

  it('returns the same migrated handle on repeated calls', async () => {
    const { getDb } = await import('../index');
    const a = await getDb();
    const b = await getDb();
    expect(b).toBe(a);
  });

  it('falls back to the default file path when DATABASE_URL is unset', async () => {
    delete process.env.DATABASE_URL;
    const { createDb } = jest.requireMock<{ createDb: jest.Mock }>('../client');
    const { getDb } = await import('../index');
    await getDb();
    expect(createDb).toHaveBeenCalledWith('file:./data/app.db', undefined);
  });
});
