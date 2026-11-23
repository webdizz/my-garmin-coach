import { and, eq, gte, lte } from 'drizzle-orm';
import type { Db } from '../client';
import { rawJson, type RawJsonRow } from '../schema';

export interface RawJsonKey {
  source: string;
  kind: string;
  date: string;
}

export function rawJsonRepo(db: Db) {
  return {
    /** Insert or overwrite the day's payload (idempotent re-pull). */
    async upsert(key: RawJsonKey, payload: unknown): Promise<void> {
      await db
        .insert(rawJson)
        .values({ ...key, payload })
        .onConflictDoUpdate({
          target: [rawJson.source, rawJson.kind, rawJson.date],
          set: { payload, fetchedAt: new Date() },
        });
    },

    async get(key: RawJsonKey): Promise<RawJsonRow | undefined> {
      const [row] = await db
        .select()
        .from(rawJson)
        .where(
          and(
            eq(rawJson.source, key.source),
            eq(rawJson.kind, key.kind),
            eq(rawJson.date, key.date)
          )
        );
      return row;
    },

    /** Inclusive date range for one kind, oldest first. */
    range(source: string, kind: string, from: string, to: string): Promise<RawJsonRow[]> {
      return db
        .select()
        .from(rawJson)
        .where(
          and(
            eq(rawJson.source, source),
            eq(rawJson.kind, kind),
            gte(rawJson.date, from),
            lte(rawJson.date, to)
          )
        )
        .orderBy(rawJson.date);
    },
  };
}
