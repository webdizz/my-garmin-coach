/** @jest-environment node */
import { createTestDb } from '../../db/testing';

jest.mock('server-only', () => ({}));
jest.mock('../../db', () => ({ getDb: jest.fn() }));

describe('requireSession', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-0123';
    process.env.APP_ORIGIN = 'http://localhost:3344';
  });

  it('returns 401 without a session cookie', async () => {
    const { getDb } = jest.requireMock<{ getDb: jest.Mock }>('../../db');
    getDb.mockResolvedValue(await createTestDb());
    const { requireSession } = await import('../index');
    const denied = await requireSession(new Request('http://localhost:3344/api/sync'));
    expect(denied?.status).toBe(401);
    expect(await denied?.json()).toEqual({ error: 'unauthorized' });
  });

  it('returns 401 for a forged session cookie', async () => {
    const { getDb } = jest.requireMock<{ getDb: jest.Mock }>('../../db');
    getDb.mockResolvedValue(await createTestDb());
    const { requireSession } = await import('../index');
    const denied = await requireSession(
      new Request('http://localhost:3344/api/sync', {
        headers: { cookie: 'better-auth.session_token=forged.signature' },
      })
    );
    expect(denied?.status).toBe(401);
  });
});
