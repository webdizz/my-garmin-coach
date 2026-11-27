import 'server-only';
import { getDb } from '../db';
import { syncRunRepo } from '../db/repos/sync-run';
import { getGarminClient } from '../garmin';
import { createScheduler } from './scheduler';
import { createSyncService, describeError, type SyncService } from './run';

export { getSyncStatus } from './status';
export { DEFAULT_DAYS, describeError, MAX_DAYS, type SyncService } from './run';

/** Instrumentation and route handlers are bundled separately, so share the instance through globalThis. */
const KEY = Symbol.for('garminconnect.sync');
type Shared = { service?: Promise<SyncService>; started?: boolean };
const shared = (globalThis as Record<symbol, Shared | undefined>)[KEY] ?? {};
(globalThis as Record<symbol, Shared>)[KEY] = shared;

export function getSyncService(): Promise<SyncService> {
  // Cleared on failure so a transient DB or config error is retried on the next call.
  shared.service ??= (async () => {
    const db = await getDb();
    await syncRunRepo(db).interruptRunning();
    return createSyncService({ db, client: getGarminClient() });
  })().catch((err: unknown) => {
    shared.service = undefined;
    throw err;
  });
  return shared.service;
}

/** Start the 09:30 / 18:00 / 23:30 scheduler once per process. Called from `instrumentation.ts`. */
export async function startSyncScheduler(): Promise<void> {
  if (shared.started) return;
  shared.started = true;
  try {
    const [db, service] = await Promise.all([getDb(), getSyncService()]);
    const runs = syncRunRepo(db);
    await createScheduler({
      run: async () => {
        const out = await service.run('schedule');
        if (out === null) console.info('[sync] scheduled pull skipped: a pull is already running');
        else if (out.status === 'error')
          console.error(
            `[sync] run ${out.runId} (schedule) error: ${out.error ?? 'unknown error'}`
          );
        else
          console.info(
            `[sync] run ${out.runId} (schedule) success: ${out.stored} day-payloads stored`
          );
      },
      lastSuccessAt: async () => (await runs.lastSuccess())?.finishedAt ?? undefined,
      onError: (err) => {
        console.error('[sync] scheduled pull failed:', describeError(err));
      },
    }).start();
  } catch (err) {
    shared.started = false;
    throw err;
  }
}
