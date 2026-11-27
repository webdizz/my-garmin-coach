/** @jest-environment node */
import { NextRequest } from 'next/server';
import { createTestDb } from '../../db/testing';

jest.mock('server-only', () => ({}));
jest.mock('../../db', () => ({ getDb: jest.fn() }));

async function loadProxy() {
  const { getDb } = jest.requireMock<{ getDb: jest.Mock }>('../../db');
  getDb.mockResolvedValue(await createTestDb());
  return (await import('../../proxy')).proxy;
}

describe('proxy gate', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.BETTER_AUTH_SECRET = 'test-secret-test-secret-test-secret-0123';
    process.env.APP_ORIGIN = 'http://localhost:3344';
  });

  it('redirects an anonymous page request to /login', async () => {
    const proxy = await loadProxy();
    const res = await proxy(new NextRequest('http://localhost:3344/trends'));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/login');
  });

  it('returns 401 for an anonymous API request', async () => {
    const proxy = await loadProxy();
    const res = await proxy(new NextRequest('http://localhost:3344/api/sync'));
    expect(res.status).toBe(401);
  });

  it('lets the login page and auth routes through without a session', async () => {
    const proxy = await loadProxy();
    expect((await proxy(new NextRequest('http://localhost:3344/login'))).status).toBe(200);
    expect(
      (await proxy(new NextRequest('http://localhost:3344/api/auth/get-session'))).status
    ).toBe(200);
  });
});
