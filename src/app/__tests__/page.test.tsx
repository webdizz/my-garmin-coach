/** @jest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { createTestDb } from '@/db/testing';
import { settingsRepo } from '@/db/repos/settings';
import { syncRunRepo } from '@/db/repos/sync-run';
import Home from '../page';
import HomeKeyStatus from '../home-key-status';

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

// Home is a sync shell; the banner is an async server component, so tests render it by awaiting.
async function renderBanner() {
  render(await HomeKeyStatus());
}

describe('Home page', () => {
  beforeEach(async () => {
    dbRef.db = await createTestDb();
  });

  it('renders without crashing', () => {
    render(<Home />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('offers a Lock now action', () => {
    render(<Home />);
    expect(screen.getByRole('button', { name: 'Lock now' })).toBeInTheDocument();
  });

  it('shows the expiry banner when the Garmin key is near its date', async () => {
    const tomorrow = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    const db = dbRef.db;
    if (!db) throw new Error('test DB not initialised');
    await settingsRepo(db).set('garmin.keyExpiresOn', tomorrow);
    await renderBanner();
    expect(screen.getByRole('status')).toHaveTextContent('Garmin key expires in');
  });

  it('shows the rejected-key alert when the latest pulls were refused', async () => {
    const db = dbRef.db;
    if (!db) throw new Error('test DB not initialised');
    const runs = syncRunRepo(db);
    const run = await runs.start('schedule');
    await runs.finish(run.id, { error: 'rejected', errorCode: 'keyInvalid' });
    await renderBanner();
    expect(screen.getByRole('alert')).toHaveTextContent('Garmin rejected the key');
  });

  it('shows no banner when no expiry date is set', async () => {
    await renderBanner();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
