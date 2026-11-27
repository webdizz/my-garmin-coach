import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getSession } from '@/auth';
import { getLoginStatus } from '@/auth/status';
import { getDb } from '@/db';
import { LoginForm } from './login-form';

export const metadata = { title: 'Unlock · Garmin Coach' };

const formatSync = (d: Date) =>
  d.toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

async function LoginStatus() {
  if (await getSession(await headers())) redirect('/');
  const status = await getLoginStatus(await getDb());
  const keyOk = status.garminKey === 'configured';

  return (
    <div className="mt-7 flex flex-col gap-1.5 font-mono text-[11px] text-[var(--color-muted)]">
      <span>
        <span
          aria-hidden
          className={`mr-1.5 inline-block size-1.5 rounded-full ${keyOk ? 'bg-[var(--color-ok)]' : 'bg-[var(--color-bad)]'}`}
        />
        {keyOk ? 'Garmin key configured' : 'Garmin key missing'}
      </span>
      <span>
        {status.lastSyncAt ? `Last sync ${formatSync(status.lastSyncAt)}` : 'No sync yet'} · data
        stays on your server
      </span>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col justify-center bg-[var(--color-bg)] px-7 text-[var(--color-text)]">
      <h1 className="text-[28px] font-semibold">Garmin Coach</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Private. One user.</p>
      <LoginForm />
      <Suspense fallback={<div className="mt-7 h-8" />}>
        <LoginStatus />
      </Suspense>
    </main>
  );
}
