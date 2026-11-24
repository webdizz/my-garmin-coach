/** Local-time pull slots (server time zone): 09:30, 18:00 and 23:30. */
export const SYNC_SLOTS: readonly { hour: number; minute: number }[] = [
  { hour: 9, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 23, minute: 30 },
];

function slotsOn(day: Date): Date[] {
  return SYNC_SLOTS.map(
    (s) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), s.hour, s.minute)
  );
}

function dayOffset(day: Date, n: number): Date {
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + n);
}

/** First slot strictly after `now`. */
export function nextSlot(now: Date): Date {
  for (const offset of [0, 1]) {
    const hit = slotsOn(dayOffset(now, offset)).find((s) => s.getTime() > now.getTime());
    if (hit) return hit;
  }
  throw new Error('unreachable: tomorrow always has a slot');
}

/** Latest slot at or before `now`. */
export function previousSlot(now: Date): Date {
  for (const offset of [0, -1]) {
    const hit = slotsOn(dayOffset(now, offset))
      .reverse()
      .find((s) => s.getTime() <= now.getTime());
    if (hit) return hit;
  }
  throw new Error('unreachable: yesterday always has a slot');
}
