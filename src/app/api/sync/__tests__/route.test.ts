/** @jest-environment node */
import { createTestDb } from '@/db/testing';

jest.mock('server-only', () => ({}));
jest.mock('@/db', () => ({ getDb: jest.fn() }));

describe('/api/sync session guard', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-0123';
    process.env.APP_ORIGIN = 'http://localhost:3344';
  });

  it('GET and POST return 401 without a session, before any sync work', async () => {
    const { getDb } = jest.requireMock<{ getDb: jest.Mock }>('@/db');
    getDb.mockResolvedValue(await createTestDb());
    const route = await import('../route');
    const req = () => new Request('http://localhost:3344/api/sync', { method: 'POST' });
    expect((await route.GET(new Request('http://localhost:3344/api/sync'))).status).toBe(401);
    expect((await route.POST(req())).status).toBe(401);
  });
});
