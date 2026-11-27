import { connection } from 'next/server';
import { Suspense } from 'react';
import { getLoginStatus } from '@/auth/status';
import { getDb } from '@/db';
import { getSyncService } from '@/sync';
import { AUTO_LOCK_MINUTES, LockControls } from '@/components/lock-controls';
import { AddNiggle, FeelingPills, KeyExpiryForm, RefreshNow, ResolveNiggle } from '@/you/actions';
import { formatLocal, keyExpiryLabel, WEEKDAYS } from '@/you/format';
import { getYouState } from '@/you/state';

export const metadata = { title: 'You · Garmin Coach' };

const SYNC_LABEL: Record<string, string> = {
  never: 'No sync yet',
  running: 'Syncing now',
  ok: 'Up to date',
  error: 'Last sync failed',
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {title}
      </h2>
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-1)] p-4">
        {children}
      </div>
    </section>
  );
}

async function YouContent() {
  // Request-time: the day, sync times and session are per request, so never prerender this.
  await connection();
  const [db, service, login] = await Promise.all([
    getDb(),
    getSyncService(),
    getLoginStatus(await getDb()),
  ]);
  const state = await getYouState(db, {
    running: service.isRunning(),
    garminKey: login.garminKey,
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col gap-5 bg-[var(--color-bg)] px-5 pt-[max(1.75rem,env(safe-area-inset-top))] pb-6 text-[var(--color-text)]">
      <header>
        <p className="text-[12px] text-[var(--color-muted)]">What the coach knows about you</p>
        <h1 className="text-[28px] font-semibold">You</h1>
      </header>

      <Section title="Today">
        <p className="mb-3 text-[13px] text-[var(--color-muted)]">How do you feel?</p>
        <FeelingPills current={state.feeling} />
      </Section>

      <Section title="Niggles and illness">
        {state.niggles.length === 0 ? (
          <p className="mb-3 text-[13px] text-[var(--color-muted)]">None active.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {state.niggles.map((n) => (
              <li key={n.id} className="flex items-center justify-between gap-2 text-[14px]">
                <span>
                  {n.label}
                  {n.bodyArea ? ` · ${n.bodyArea}` : ''}
                  <span className="text-[var(--color-muted)]"> · since {n.startedOn}</span>
                </span>
                <ResolveNiggle id={n.id} label={n.label} />
              </li>
            ))}
          </ul>
        )}
        <AddNiggle />
      </Section>

      <Section title="Goal">
        {state.goal ? (
          <p className="text-[14px]">
            {state.goal.event} · {state.goal.date}
            {state.goal.target ? ` · ${state.goal.target}` : ''}
          </p>
        ) : (
          <p className="text-[13px] text-[var(--color-muted)]">No goal set.</p>
        )}
      </Section>

      <Section title="Training slots">
        {state.slots.length === 0 ? (
          <p className="text-[13px] text-[var(--color-muted)]">No slots yet.</p>
        ) : (
          <ul className="flex flex-col gap-2 text-[14px]">
            {state.slots.map((s) => (
              <li key={s.id} className="flex justify-between">
                <span>
                  {WEEKDAYS[s.weekday]} · {s.kind}
                </span>
                <span className="font-mono text-[var(--color-muted)]">
                  {s.start}–{s.end}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Data">
        <div className="flex flex-col gap-3 text-[14px]">
          <p>
            {SYNC_LABEL[state.sync.state]} · last pull {formatLocal(state.sync.lastSuccessAt)}
          </p>
          <p className="text-[12px] text-[var(--color-muted)]">
            Next pull {formatLocal(state.sync.nextPullAt)}
          </p>
          <RefreshNow />
          <p className="text-[12px] text-[var(--color-muted)]">
            Garmin key{' '}
            {state.garminKey === 'configured' ? 'configured' : 'missing (set it on the server)'}
            {state.garminKey === 'configured' && `, ${keyExpiryLabel(state.keyExpiry)}`}
            {state.keyInvalid && ' · rejected by Garmin, pulls backing off'}
          </p>
          <KeyExpiryForm
            current={state.keyExpiry.state === 'unknown' ? null : state.keyExpiry.expiresOn}
          />
        </div>
      </Section>

      <Section title="Security">
        <div className="flex flex-col gap-3 text-[14px]">
          <p>Unlock with Face ID, password as fallback</p>
          <p>Auto-lock after {AUTO_LOCK_MINUTES} min</p>
          <LockControls />
        </div>
      </Section>

      <p className="text-center text-[11px] text-[var(--color-dimmed)]">
        Informational, not medical advice. Data stays on your server.
      </p>
    </main>
  );
}

/** Request-time data sits behind Suspense so the route can be prerendered as a shell. */
export default function YouPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--color-bg)]" />}>
      <YouContent />
    </Suspense>
  );
}
