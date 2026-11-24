import { desc, eq } from 'drizzle-orm';
import type { Db } from '../client';
import { syncRun, type SyncRunRow } from '../schema';

type Trigger = SyncRunRow['trigger'];

export function syncRunRepo(db: Db) {
  return {
    async start(trigger: Trigger): Promise<SyncRunRow> {
      const [row] = await db.insert(syncRun).values({ trigger }).returning();
      return row;
    },

    async finish(id: string, outcome: { error?: string } = {}): Promise<void> {
      await db
        .update(syncRun)
        .set({
          status: outcome.error !== undefined ? 'error' : 'success',
          error: outcome.error ?? null,
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
