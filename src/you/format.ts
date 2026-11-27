/** Local-time label for an ISO instant, e.g. "10 Mar, 09:31". Shown in the viewer's local zone, never raw UTC. */
export function formatLocal(iso: string | null): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const WEEKDAYS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Feeling options. Kept here, not imported from the DB schema, so client code never reaches src/db. Keep in sync with FEELINGS in src/db/schema.ts. */
export const FEELINGS = ['rough', 'tired', 'ok', 'good', 'great'] as const;

/** One-line status for the Garmin key, e.g. "expires in 12 days (2026-12-09)". */
export function keyExpiryLabel(
  expiry:
    | { state: 'unknown' }
    | { state: 'ok' | 'expiring' | 'expired'; expiresOn: string; daysLeft: number }
): string {
  if (expiry.state === 'unknown') return 'expiry date not set';
  if (expiry.state === 'expired') return `expired on ${expiry.expiresOn}`;
  if (expiry.daysLeft === 0) return `expires today (${expiry.expiresOn})`;
  const unit = expiry.daysLeft === 1 ? 'day' : 'days';
  return `expires in ${expiry.daysLeft} ${unit} (${expiry.expiresOn})`;
}
