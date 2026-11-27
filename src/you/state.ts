import 'server-only';
import type { Db } from '../db/client';
import { youProfileRepo } from '../db/repos/you-profile';
import type { Feeling } from '../db/repos/you-profile';
import { getSyncStatus, type SyncStatus } from '../sync';
import type { NiggleRow } from '../db/schema';

/** Everything the You screen renders. Plain, serialisable data: dates are ISO strings. */
export interface YouState {
  today: string;
  feeling: Feeling | null;
  niggles: {
    id: string;
    label: string;
    bodyArea: string | null;
    severity: number;
    startedOn: string;
  }[];
  goal: { event: string; date: string; target: string | null } | null;
  slots: { id: string; weekday: number; start: string; end: string; kind: string }[];
  sync: { state: SyncStatus['state']; lastSuccessAt: string | null; nextPullAt: string };
  garminKey: 'configured' | 'missing';
}

/** Local calendar day as YYYY-MM-DD, using the server's local timezone. */
export function localDay(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toNiggle(row: NiggleRow): YouState['niggles'][number] {
  return {
    id: row.id,
    label: row.label,
    bodyArea: row.bodyArea,
    severity: row.severity,
    startedOn: row.startedOn,
  };
}

/** Loads the You screen state. `running` is the live in-process sync flag; `garminKey` is pass-through from the login status. */
export async function getYouState(
  db: Db,
  opts: { running: boolean; garminKey: 'configured' | 'missing'; now?: Date }
): Promise<YouState> {
  const now = opts.now ?? new Date();
  const today = localDay(now);
  const repo = youProfileRepo(db);
  const [checkin, niggles, goal, slots, sync] = await Promise.all([
    repo.feelingOn(today),
    repo.activeNiggles(),
    repo.activeGoal(),
    repo.activeSlots(),
    getSyncStatus(db, { running: opts.running, now }),
  ]);
  return {
    today,
    feeling: checkin?.feeling ?? null,
    niggles: niggles.map(toNiggle),
    goal: goal ? { event: goal.event, date: goal.date, target: goal.target } : null,
    slots: slots.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      start: s.start,
      end: s.end,
      kind: s.kind,
    })),
    sync: { state: sync.state, lastSuccessAt: sync.lastSuccessAt, nextPullAt: sync.nextPullAt },
    garminKey: opts.garminKey,
  };
}
