import type { Db } from '../db/client';
import { syncRunRepo } from '../db/repos/sync-run';
import { nextSlot } from './slots';

export interface SyncStatus {
  /** `never`: no run yet. `error`: the latest finished run failed. */
  state: 'never' | 'running' | 'ok' | 'error';
  lastRun: {
    trigger: 'manual' | 'schedule';
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  } | null;
  lastSuccessAt: string | null;
  nextPullAt: string;
  /** Garmin rejected the key on the last `count` runs in a row. `count` 0 = not rejected. */
  keyInvalid: { count: number; lastAt: string | null };
}

export async function getSyncStatus(
  db: Db,
  opts: { running: boolean; now?: Date }
): Promise<SyncStatus> {
  const runs = syncRunRepo(db);
  const [latest, success, streak] = await Promise.all([
    runs.latest(),
    runs.lastSuccess(),
    runs.keyInvalidStreak(),
  ]);
  const state = opts.running
    ? 'running'
    : !latest
      ? 'never'
      : latest.status === 'error'
        ? 'error'
        : 'ok';
  return {
    state,
    lastRun: latest
      ? {
          trigger: latest.trigger,
          startedAt: latest.startedAt.toISOString(),
          finishedAt: latest.finishedAt?.toISOString() ?? null,
          error: latest.error,
        }
      : null,
    lastSuccessAt: success?.finishedAt?.toISOString() ?? null,
    nextPullAt: nextSlot(opts.now ?? new Date()).toISOString(),
    keyInvalid: { count: streak.count, lastAt: streak.lastAt?.toISOString() ?? null },
  };
}
