'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/auth/client';

export function EnrollForm() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');

  async function enroll() {
    // The token lives in the URL fragment so it is never sent to the server or written to access logs.
    const token = window.location.hash.slice(1);
    if (!token) {
      setState('error');
      return;
    }
    setState('busy');
    const { error } = await authClient.passkey.addPasskey({
      name: 'This device',
      context: token,
      createSession: true,
    });
    if (error) {
      setState('error');
      return;
    }
    window.history.replaceState(null, '', window.location.pathname);
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void enroll()}
        disabled={state === 'busy'}
        className="mt-6 w-full rounded-xl bg-[var(--color-accent)] p-3.5 text-[15px] font-semibold text-[#10160a] disabled:opacity-60"
      >
        {state === 'busy' ? 'Waiting for Face ID…' : 'Create passkey'}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-2.5 text-[13px] text-[var(--color-bad)]">
          This link is invalid, expired or already used. Run <code>npm run auth:enroll</code> on the
          host for a new one.
        </p>
      )}
    </>
  );
}
