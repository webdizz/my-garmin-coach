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

    async latest(): Promise<SyncRunRow | undefined> {
      const [row] = await db.select().from(syncRun).orderBy(desc(syncRun.id)).limit(1);
      return row;
    },
  };
}
