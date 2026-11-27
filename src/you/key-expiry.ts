/** Days before expiry at which the key is shown as expiring. */
export const KEY_EXPIRY_WARN_DAYS = 14;

export type KeyExpiry =
  | { state: 'unknown' }
  | { state: 'ok'; expiresOn: string; daysLeft: number }
  | { state: 'expiring'; expiresOn: string; daysLeft: number }
  | { state: 'expired'; expiresOn: string; daysLeft: number };

const DAY_MS = 86_400_000;

/** Whole days from `today` to `expiresOn`, both YYYY-MM-DD in the same calendar. Negative once past. */
function daysBetween(today: string, expiresOn: string): number {
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${expiresOn}T00:00:00Z`);
  return Math.round((b - a) / DAY_MS);
}

/**
 * Classifies the Garmin personal API key from its expiry date.
 * The date is entered by the user (Garmin does not expose it through the API).
 * `today` is the local calendar day, YYYY-MM-DD. A key is still valid on its expiry day.
 */
export function keyExpiry(expiresOn: string | null | undefined, today: string): KeyExpiry {
  if (!expiresOn) return { state: 'unknown' };
  const daysLeft = daysBetween(today, expiresOn);
  if (daysLeft < 0) return { state: 'expired', expiresOn, daysLeft };
  if (daysLeft <= KEY_EXPIRY_WARN_DAYS) return { state: 'expiring', expiresOn, daysLeft };
  return { state: 'ok', expiresOn, daysLeft };
}

import { ProfileInputError } from '../db/repos/you-profile';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses the expiry date from user input. `null` clears it. Throws on anything else that is not a real YYYY-MM-DD date. */
export function parseKeyExpiry(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new ProfileInputError('expiresOn must be YYYY-MM-DD or null');
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new ProfileInputError('expiresOn is not a real date');
  }
  return value;
}
