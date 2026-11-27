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

/** Self-reported feeling for one local day (YYYY-MM-DD). At most one row per day. */
export const FEELINGS = ['rough', 'tired', 'ok', 'good', 'great'] as const;

export const dailyCheckin = sqliteTable(
  'daily_checkin',
  {
    id: id(),
    date: text({ length: 10 }).notNull(),
    feeling: text({ enum: FEELINGS }).notNull(),
    updatedAt: nowMs(),
  },
  (t) => [uniqueIndex('daily_checkin_date_uq').on(t.date)]
);

/** Injury or illness the user tells the coach about. `resolvedOn` null = still active. */
export const niggle = sqliteTable(
  'niggle',
  {
    id: id(),
    label: text().notNull(),
    bodyArea: text(),
    severity: integer().notNull().default(1),
    startedOn: text({ length: 10 }).notNull(),
    resolvedOn: text({ length: 10 }),
    note: text(),
    createdAt: nowMs(),
  },
  (t) => [index('niggle_active_idx').on(t.resolvedOn)]
);

/** Training goal. The repo keeps one active goal at a time. */
export const goal = sqliteTable('goal', {
  id: id(),
  event: text().notNull(),
  /** Event day, YYYY-MM-DD. */
  date: text({ length: 10 }).notNull(),
  target: text(),
  active: integer({ mode: 'boolean' }).notNull().default(true),
  createdAt: nowMs(),
});

/** Weekly training slot. `weekday` 1 = Monday ... 7 = Sunday; times are local HH:MM. */
export const trainingSlot = sqliteTable(
  'training_slot',
  {
    id: id(),
    weekday: integer().notNull(),
    start: text({ length: 5 }).notNull(),
    end: text({ length: 5 }).notNull(),
    kind: text().notNull(),
    active: integer({ mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('training_slot_weekday_idx').on(t.weekday)]
);

export type RawJsonRow = typeof rawJson.$inferSelect;
export type SyncRunRow = typeof syncRun.$inferSelect;
export type SettingRow = typeof settings.$inferSelect;
export type DailyCheckinRow = typeof dailyCheckin.$inferSelect;
export type NiggleRow = typeof niggle.$inferSelect;
export type GoalRow = typeof goal.$inferSelect;
export type TrainingSlotRow = typeof trainingSlot.$inferSelect;

export * from './auth-schema';
