'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/auth/client';

export function LoginForm() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle');

  async function unlock() {
    setState('busy');
    const { error } = await authClient.signIn.passkey();
    if (error) {
      setState('error');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void unlock()}
        disabled={state === 'busy'}
        className="mt-6 w-full rounded-xl bg-[var(--color-accent)] p-3.5 text-[15px] font-semibold text-[#10160a] disabled:opacity-60"
      >
        {state === 'busy' ? 'Waiting for Face ID…' : 'Unlock with Face ID'}
      </button>
      {state === 'error' && (
        <p role="alert" className="mt-2.5 text-[13px] text-[var(--color-bad)]">
          Face ID did not match. Try again, or enroll this device with{' '}
          <code>npm run auth:enroll</code> on the host.
        </p>
      )}
    </>
  );
}
