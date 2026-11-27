const HOUR_MS = 3_600_000;
const BASE_MS = 6 * HOUR_MS;
const CAP_MS = 24 * HOUR_MS;

/**
 * How long scheduled pulls wait after Garmin rejected the key `failures` times in a row.
 * `min(6h * 2^(n-1), 24h)`: 6 h, 12 h, 24 h, then 24 h. Returns 0 when there is no streak.
 */
export function keyBackoffMs(failures: number): number {
  if (failures < 1) return 0;
  return Math.min(BASE_MS * 2 ** (failures - 1), CAP_MS);
}

/**
 * True while a scheduled pull should wait: the last key rejection was less than the backoff ago.
 */
export function keyBackoffActive(streak: { count: number; lastAt?: Date }, now: Date): boolean {
  if (streak.count < 1 || !streak.lastAt) return false;
  return now.getTime() < streak.lastAt.getTime() + keyBackoffMs(streak.count);
}
