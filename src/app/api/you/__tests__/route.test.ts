/** @jest-environment node */
import { createTestDb } from '@/db/testing';
import { youProfileRepo } from '@/db/repos/you-profile';
import { POST } from '../route';

const denied = jest.fn<Promise<Response | null>, [Request]>();
jest.mock('server-only', () => ({}));
jest.mock('@/auth', () => ({ requireSession: (r: Request) => denied(r) }));
const dbRef: { db?: Awaited<ReturnType<typeof createTestDb>> } = {};
function requireDb() {
  if (!dbRef.db) throw new Error('test DB not initialised');
  return dbRef.db;
}
jest.mock('@/db', () => ({ getDb: jest.fn(async () => dbRef.db) }));

const URL_ = 'http://localhost:3344/api/you';
const post = (body?: unknown, headers: Record<string, string> = {}) =>
  new Request(URL_, {
    method: 'POST',
    headers: { host: 'localhost:3344', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

describe('/api/you POST', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    denied.mockResolvedValue(null);
    dbRef.db = await createTestDb();
  });

  it('refuses without a session, before touching the DB', async () => {
    denied.mockResolvedValue(Response.json({ error: 'unauthorized' }, { status: 401 }));
    const res = await POST(post({ action: 'feeling', feeling: 'ok' }));
    expect(res.status).toBe(401);
    expect(await youProfileRepo(requireDb()).activeNiggles()).toEqual([]);
  });

  it('refuses a cross-site origin', async () => {
    const res = await POST(
      post({ action: 'feeling', feeling: 'ok' }, { origin: 'https://evil.example' })
    );
    expect(res.status).toBe(403);
  });

  it('refuses an unparseable origin', async () => {
    expect(
      (await POST(post({ action: 'feeling', feeling: 'ok' }, { origin: 'null' }))).status
    ).toBe(403);
  });

  it('rejects a non-object body', async () => {
    const req = new Request(URL_, {
      method: 'POST',
      headers: { host: 'localhost:3344' },
      body: '"str"',
    });
    expect((await POST(req)).status).toBe(400);
    const empty = new Request(URL_, { method: 'POST', headers: { host: 'localhost:3344' } });
    expect((await POST(empty)).status).toBe(400);
  });

  it('rejects an unknown action', async () => {
    expect((await POST(post({ action: 'delete-everything' }))).status).toBe(400);
  });

  it('saves a feeling and rejects an unknown one', async () => {
    expect((await POST(post({ action: 'feeling', feeling: 'great' }))).status).toBe(200);
    expect((await POST(post({ action: 'feeling', feeling: 'meh' }))).status).toBe(400);
  });

  it('adds a niggle with 201 and reports bad input by field name only', async () => {
    expect((await POST(post({ action: 'addNiggle', label: 'Calf' }))).status).toBe(201);
    const res = await POST(post({ action: 'addNiggle', label: '' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'label is required' });
  });

  it('resolves a niggle, 404 when the id is unknown, 400 when id is missing', async () => {
    await POST(post({ action: 'addNiggle', label: 'Calf' }));
    const [row] = await youProfileRepo(requireDb()).activeNiggles();
    expect((await POST(post({ action: 'resolveNiggle', id: row.id }))).status).toBe(200);
    expect((await POST(post({ action: 'resolveNiggle', id: 'nope' }))).status).toBe(404);
    expect((await POST(post({ action: 'resolveNiggle' }))).status).toBe(400);
  });

  it('sets a goal and rejects a bad date', async () => {
    expect(
      (await POST(post({ action: 'setGoal', event: 'Half', date: '2030-10-12' }))).status
    ).toBe(201);
    expect(
      (await POST(post({ action: 'setGoal', event: 'Half', date: '2030-13-01' }))).status
    ).toBe(400);
  });
});
