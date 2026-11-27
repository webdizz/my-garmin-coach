import { desc, eq, ne } from 'drizzle-orm';
import type { Db } from '../client';
import { SYNC_ERROR_CODES, syncRun, type SyncRunRow } from '../schema';

type Trigger = SyncRunRow['trigger'];
type SyncErrorCode = (typeof SYNC_ERROR_CODES)[number];

/** Bounds the streak scan. A dead key is probed a few times a day, so 50 rows is far more than needed. */
const STREAK_SCAN_LIMIT = 50;

export function syncRunRepo(db: Db) {
  return {
    async start(trigger: Trigger): Promise<SyncRunRow> {
      const [row] = await db.insert(syncRun).values({ trigger }).returning();
      return row;
    },

    async finish(
      id: string,
      outcome: { error?: string; errorCode?: SyncErrorCode } = {}
    ): Promise<void> {
      await db
        .update(syncRun)
        .set({
          status: outcome.error !== undefined ? 'error' : 'success',
          error: outcome.error ?? null,
          errorCode: outcome.errorCode ?? null,
          finishedAt: new Date(),
        })
        .where(eq(syncRun.id, id));
    },

    /** Mark runs left `running` by a crashed or restarted process as failed. Call once at startup. */
    async interruptRunning(): Promise<void> {
      await db
        .update(syncRun)
        .set({ status: 'error', error: 'interrupted', finishedAt: new Date() })
        .where(eq(syncRun.status, 'running'));
    },

    /**
     * Consecutive newest finished runs that failed with `keyInvalid`, and when the newest of them
     * finished. Stops at the first run that did not fail that way.
     */
    async keyInvalidStreak(): Promise<{ count: number; lastAt?: Date }> {
      const rows = await db
        .select({ errorCode: syncRun.errorCode, finishedAt: syncRun.finishedAt })
        .from(syncRun)
        .where(ne(syncRun.status, 'running'))
        .orderBy(desc(syncRun.id))
        .limit(STREAK_SCAN_LIMIT);
      let count = 0;
      for (const row of rows) {
        if (row.errorCode !== 'keyInvalid') break;
        count++;
      }
      return { count, lastAt: count > 0 ? (rows[0].finishedAt ?? undefined) : undefined };
    },

    async lastSuccess(): Promise<SyncRunRow | undefined> {
      const [row] = await db
        .select()
        .from(syncRun)
        .where(eq(syncRun.status, 'success'))
        .orderBy(desc(syncRun.id))
        .limit(1);
      return row;
    },

    async latest(): Promise<SyncRunRow | undefined> {
      const [row] = await db.select().from(syncRun).orderBy(desc(syncRun.id)).limit(1);
      return row;
    },
  };
}
