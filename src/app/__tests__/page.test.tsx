/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { createTestDb } from '@/db/testing';
import { settingsRepo } from '@/db/repos/settings';
import Home from '../page';

// Synthetic data only.
const dbRef: { db?: Awaited<ReturnType<typeof createTestDb>> } = {};
jest.mock('server-only', () => ({}));
jest.mock('next/server', () => ({ connection: jest.fn(async () => undefined) }));
jest.mock('@/db', () => ({ getDb: jest.fn(async () => dbRef.db) }));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: jest.fn(), refresh: jest.fn() }),
}));
jest.mock('@/auth/client', () => ({
  authClient: { signOut: jest.fn(), getSession: jest.fn() },
}));

// Home is an async server component; await the element before rendering it.
async function renderHome() {
  render(await Home());
}

describe('Home page', () => {
  beforeEach(async () => {
    dbRef.db = await createTestDb();
  });

  it('renders without crashing', async () => {
    await renderHome();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('offers a Lock now action', async () => {
    await renderHome();
    expect(screen.getByRole('button', { name: 'Lock now' })).toBeInTheDocument();
  });

  it('shows the expiry banner when the Garmin key is near its date', async () => {
    const tomorrow = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const db = dbRef.db;
    if (!db) throw new Error('test DB not initialised');
    await settingsRepo(db).set('garmin.keyExpiresOn', tomorrow);
    await renderHome();
    expect(screen.getByRole('status')).toHaveTextContent('Garmin key expires in');
  });

  it('shows no banner when no expiry date is set', async () => {
    await renderHome();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
