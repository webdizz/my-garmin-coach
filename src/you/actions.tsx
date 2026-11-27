'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { FEELINGS } from './format';

type Post = { action: string } & Record<string, unknown>;

/** POSTs one action to /api/you, then refreshes the server-rendered screen. Returns an error message or null. */
function useYouAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const send = (body: Post) => {
    start(async () => {
      const res = await fetch('/api/you', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError('Could not save. Try again.');
        return;
      }
      setError(null);
      router.refresh();
    });
  };
  return { send, pending, error };
}

const LABEL: Record<(typeof FEELINGS)[number], string> = {
  rough: 'Rough',
  tired: 'Tired',
  ok: 'OK',
  good: 'Good',
  great: 'Great',
};

/** Pills for today's feeling. Tapping one saves it for today. */
export function FeelingPills({ current }: { current: string | null }) {
  const { send, pending, error } = useYouAction();
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Feeling today">
        {FEELINGS.map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={current === f}
            disabled={pending}
            onClick={() => {
              send({ action: 'feeling', feeling: f });
            }}
            className={`rounded-full border px-3 py-1.5 text-[13px] ${
              current === f
                ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'border-[var(--color-line)] text-[var(--color-muted)]'
            }`}
          >
            {LABEL[f]}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--color-bad)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Add-niggle form: label, optional body area. Severity defaults to 1 on the server. */
export function AddNiggle() {
  const { send, pending, error } = useYouAction();
  const [label, setLabel] = useState('');
  const [bodyArea, setBodyArea] = useState('');
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!label.trim()) return;
        send({ action: 'addNiggle', label, bodyArea: bodyArea || undefined });
        setLabel('');
        setBodyArea('');
      }}
    >
      <label className="text-[12px] text-[var(--color-muted)]">
        Niggle or illness
        <input
          value={label}
          onChange={(e) => {
            setLabel(e.target.value);
          }}
          maxLength={120}
          required
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-1)] p-2 text-[14px] text-[var(--color-text)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-[var(--color-muted)]"
      >
        + Add
      </button>
      {error && (
        <p role="alert" className="text-[13px] text-[var(--color-bad)]">
          {error}
        </p>
      )}
    </form>
  );
}

/** Button that marks a niggle resolved today. */
export function ResolveNiggle({ id, label }: { id: string; label: string }) {
  const { send, pending } = useYouAction();
  return (
    <button
      type="button"
      disabled={pending}
      aria-label={`Mark ${label} resolved`}
      onClick={() => {
        send({ action: 'resolveNiggle', id });
      }}
      className="rounded-full border border-[var(--color-line)] px-3 py-1 text-[12px] text-[var(--color-muted)]"
    >
      Resolved
    </button>
  );
}

/** Refresh-now button. Calls the existing sync endpoint, then re-renders the freshness line. */
export function RefreshNow() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          start(async () => {
            const res = await fetch('/api/sync', { method: 'POST' });
            if (!res.ok && res.status !== 409) {
              setError('Could not start a refresh.');
              return;
            }
            setError(null);
            router.refresh();
          });
        }}
        className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-[var(--color-muted)] disabled:opacity-60"
      >
        {pending ? 'Refreshing…' : 'Refresh now'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-[var(--color-bad)]">
          {error}
        </p>
      )}
    </div>
  );
}

/** Saves the Garmin key expiry date (YYYY-MM-DD). Empty input clears it. */
export function KeyExpiryForm({ current }: { current: string | null }) {
  const { send, pending, error } = useYouAction();
  const [value, setValue] = useState(current ?? '');
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        send({ action: 'setKeyExpiry', expiresOn: value === '' ? null : value });
      }}
    >
      <label className="text-[12px] text-[var(--color-muted)]">
        Key expires on (copy it from Garmin Connect)
        <input
          type="date"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-1)] p-2 text-[14px] text-[var(--color-text)]"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-[13px] text-[var(--color-muted)]"
      >
        Save expiry
      </button>
      {error && (
        <p role="alert" className="text-[13px] text-[var(--color-bad)]">
          {error}
        </p>
      )}
    </form>
  );
}
