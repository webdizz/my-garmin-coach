import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { newId } from './id';

const id = () =>
  text('id', { length: 26 })
    .primaryKey()
    .$defaultFn(() => newId());

const nowMs = () =>
  integer({ mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

/** Verbatim Garmin responses. One row per (source, kind, date); a re-pull overwrites it. */
export const rawJson = sqliteTable(
  'raw_json',
  {
    id: id(),
    source: text().notNull(),
    kind: text().notNull(),
    /** Local calendar day, YYYY-MM-DD. */
    date: text({ length: 10 }).notNull(),
    payload: text({ mode: 'json' }).$type<unknown>().notNull(),
    fetchedAt: nowMs(),
  },
  (t) => [
    uniqueIndex('raw_json_source_kind_date_uq').on(t.source, t.kind, t.date),
    index('raw_json_kind_date_idx').on(t.kind, t.date),
  ]
);

export const SYNC_TRIGGERS = ['manual', 'schedule'] as const;
export const SYNC_STATUSES = ['running', 'success', 'error'] as const;

export const syncRun = sqliteTable(
  'sync_run',
  {
    id: id(),
    trigger: text({ enum: SYNC_TRIGGERS }).notNull(),
    status: text({ enum: SYNC_STATUSES }).notNull().default('running'),
    startedAt: nowMs(),
    finishedAt: integer({ mode: 'timestamp_ms' }),
    error: text(),
  },
  (t) => [index('sync_run_started_idx').on(t.startedAt)]
);

export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text({ mode: 'json' }).$type<unknown>().notNull(),
  updatedAt: nowMs(),
});

export type RawJsonRow = typeof rawJson.$inferSelect;
export type SyncRunRow = typeof syncRun.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
