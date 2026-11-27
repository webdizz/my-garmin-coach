'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import { authClient } from '@/auth/client';

const IDLE_MS = 5 * 60 * 1000;
/** Minimum gap between keep-alive calls that slide the server session forward. */
const PING_MS = 30 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const;

/** "Lock now" button plus the client side half of the 5 minute auto-lock. */
export function LockControls() {
  const router = useRouter();
  const idleTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const lastPing = useRef(0);

  const lock = useCallback(async () => {
    await authClient.signOut();
    router.replace('/login');
    router.refresh();
  }, [router]);

  useEffect(() => {
    const arm = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => void lock(), IDLE_MS);
    };
    const onActivity = () => {
      arm();
      const now = Date.now();
      if (now - lastPing.current > PING_MS) {
        lastPing.current = now;
        void authClient.getSession();
      }
    };
    arm();
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    return () => {
      clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity));
    };
  }, [lock]);

  return (
    <button
      type="button"
      onClick={() => void lock()}
      className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-[var(--color-muted)]"
    >
      Lock now
    </button>
  );
}
