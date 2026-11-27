/** @jest-environment node */
import { createTestDb } from '@/db/testing';
import { settingsRepo } from '@/db/repos/settings';
const denied = jest.fn<Promise<Response | null>, [Request]>();
const service = {
  isRunning: jest.fn(() => false),
  run: jest.fn(async () => null),
};

jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ requireSession: (r: Request) => denied(r) }));
const dbRef: { db?: unknown } = {};
jest.mock('@/db', () => ({ getDb: jest.fn(async () => dbRef.db) }));
jest.mock('@/sync', () => ({
  DEFAULT_DAYS: 3,
  MAX_DAYS: 365,
  describeError: (e: unknown) => (e instanceof Error ? e.message : 'unknown'),
  getSyncService: jest.fn(async () => service),
  getSyncStatus: jest.fn(async () => ({ state: 'ok' })),
}));

const URL_ = 'http://localhost:3344/api/sync';
const post = (body?: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, {
    method: 'POST',
    headers: { host: 'localhost:3344', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('/api/sync handlers', () => {
  beforeEach(async () => {
    dbRef.db = await createTestDb();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    denied.mockResolvedValue(null);
    service.isRunning.mockReturnValue(false);
  });

  it('GET returns the sync status for a signed-in user', async () => {
    const { GET } = await import('../route');
    const res = await GET(new Request(URL_));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: 'ok' });
  });

  it('GET stops at the session guard', async () => {
    denied.mockResolvedValue(Response.json({ error: 'unauthorized' }, { status: 401 }));
    const { GET } = await import('../route');
    expect((await GET(new Request(URL_))).status).toBe(401);
  });

  it('POST returns 202 and starts a manual pull with the default window', async () => {
    const { POST } = await import('../route');
    const res = await POST(post());
    expect(res.status).toBe(202);
    expect(service.run).toHaveBeenCalledWith('manual', { days: 3 });
  });

  it('POST refuses a cross-site origin', async () => {
    const { POST } = await import('../route');
    const res = await POST(post(undefined, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(service.run).not.toHaveBeenCalled();
  });

  it('POST refuses an unparseable origin', async () => {
    const { POST } = await import('../route');
    expect((await POST(post(undefined, { origin: 'null' }))).status).toBe(403);
  });

  it('POST accepts a same-site origin', async () => {
    const { POST } = await import('../route');
    const res = await POST(post(undefined, { origin: 'http://localhost:3344' }));
    expect(res.status).toBe(202);
  });

  it('POST rejects an out-of-range window with 400', async () => {
    const { POST } = await import('../route');
    expect((await POST(post({ days: 0 }))).status).toBe(400);
    expect((await POST(post({ days: 1.5 }))).status).toBe(400);
    expect((await POST(post({ days: 'x' }))).status).toBe(400);
    expect(service.run).not.toHaveBeenCalled();
  });

  it('POST accepts a valid window', async () => {
    const { POST } = await import('../route');
    expect((await POST(post({ days: 7 }))).status).toBe(202);
    expect(service.run).toHaveBeenCalledWith('manual', { days: 7 });
  });

  it('POST returns 409 when a pull is already running', async () => {
    service.isRunning.mockReturnValue(true);
    const { POST } = await import('../route');
    expect((await POST(post())).status).toBe(409);
    expect(service.run).not.toHaveBeenCalled();
  });

  it('POST refuses with 409 keyExpired once the Garmin key date has passed', async () => {
    await settingsRepo(dbRef.db as Awaited<ReturnType<typeof createTestDb>>).set(
      'garmin.keyExpiresOn',
      '2000-01-01'
    );
    const { POST } = await import('../route');
    const res = await POST(post({ days: 3 }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'keyExpired' });
    expect(service.run).not.toHaveBeenCalled();
  });

  it('POST still runs when the key date is in the future or unknown', async () => {
    const { POST } = await import('../route');
    expect((await POST(post({ days: 3 }))).status).toBe(202);
  });
});
