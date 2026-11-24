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
}

export async function getSyncStatus(
  db: Db,
  opts: { running: boolean; now?: Date }
): Promise<SyncStatus> {
  const runs = syncRunRepo(db);
  const [latest, success] = await Promise.all([runs.latest(), runs.lastSuccess()]);
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
  };
}
