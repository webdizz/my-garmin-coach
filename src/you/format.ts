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
