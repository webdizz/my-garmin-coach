import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client';
import {
  dailyCheckin,
  FEELINGS,
  goal,
  niggle,
  trainingSlot,
  type DailyCheckinRow,
  type GoalRow,
  type NiggleRow,
  type TrainingSlotRow,
} from '../schema';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const MAX_TEXT = 120;
const MAX_NOTE = 500;

export type Feeling = (typeof FEELINGS)[number];

export class ProfileInputError extends Error {}

function text(value: unknown, field: string, max: number, required: boolean): string | null {
  if (value === undefined || value === null || value === '') {
    if (required) throw new ProfileInputError(`${field} is required`);
    return null;
  }
  if (typeof value !== 'string') throw new ProfileInputError(`${field} must be a string`);
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    if (required) throw new ProfileInputError(`${field} is required`);
    return null;
  }
  if (trimmed.length > max)
    throw new ProfileInputError(`${field} must be at most ${max} characters`);
  return trimmed;
}

function date(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DATE_RE.test(value)) {
    throw new ProfileInputError(`${field} must be YYYY-MM-DD`);
  }
  const d = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    throw new ProfileInputError(`${field} is not a real date`);
  }
  return value;
}

export function parseFeeling(value: unknown): Feeling {
  if (typeof value !== 'string' || !(FEELINGS as readonly string[]).includes(value)) {
    throw new ProfileInputError(`feeling must be one of ${FEELINGS.join(', ')}`);
  }
  return value as Feeling;
}

export function youProfileRepo(db: Db) {
  return {
    /** Upserts the feeling for `day`. Re-selecting a feeling on the same day overwrites it. */
    async setFeeling(day: string, feeling: Feeling): Promise<void> {
      const d = date(day, 'date');
      const f = parseFeeling(feeling);
      await db
        .insert(dailyCheckin)
        .values({ date: d, feeling: f })
        .onConflictDoUpdate({
          target: dailyCheckin.date,
          set: { feeling: f, updatedAt: new Date() },
        });
    },

    async feelingOn(day: string): Promise<DailyCheckinRow | undefined> {
      const [row] = await db
        .select()
        .from(dailyCheckin)
        .where(eq(dailyCheckin.date, date(day, 'date')));
      return row;
    },

    async addNiggle(input: {
      label: unknown;
      bodyArea?: unknown;
      severity?: unknown;
      startedOn: unknown;
      note?: unknown;
    }): Promise<NiggleRow> {
      const sev = input.severity ?? 1;
      if (typeof sev !== 'number' || !Number.isInteger(sev) || sev < 1 || sev > 5) {
        throw new ProfileInputError('severity must be an integer from 1 to 5');
      }
      const [row] = await db
        .insert(niggle)
        .values({
          label: text(input.label, 'label', MAX_TEXT, true) as string,
          bodyArea: text(input.bodyArea, 'bodyArea', MAX_TEXT, false),
          severity: sev,
          startedOn: date(input.startedOn, 'startedOn'),
          note: text(input.note, 'note', MAX_NOTE, false),
        })
        .returning();
      return row;
    },

    /** Marks a niggle resolved on `day`. Returns false when no active niggle has that id. */
    async resolveNiggle(id: string, day: string): Promise<boolean> {
      const rows = await db
        .update(niggle)
        .set({ resolvedOn: date(day, 'resolvedOn') })
        .where(and(eq(niggle.id, id), isNull(niggle.resolvedOn)))
        .returning({ id: niggle.id });
      return rows.length > 0;
    },

    async activeNiggles(): Promise<NiggleRow[]> {
      return db
        .select()
        .from(niggle)
        .where(isNull(niggle.resolvedOn))
        .orderBy(desc(niggle.startedOn), asc(niggle.id));
    },

    /** Replaces the active goal: deactivates the previous one, then inserts the new one. */
    async setGoal(input: { event: unknown; date: unknown; target?: unknown }): Promise<GoalRow> {
      const event = text(input.event, 'event', MAX_TEXT, true) as string;
      const eventDate = date(input.date, 'date');
      const target = text(input.target, 'target', MAX_TEXT, false);
      return db.transaction(async (tx) => {
        await tx.update(goal).set({ active: false }).where(eq(goal.active, true));
        const [row] = await tx.insert(goal).values({ event, date: eventDate, target }).returning();
        return row;
      });
    },

    async activeGoal(): Promise<GoalRow | undefined> {
      const [row] = await db
        .select()
        .from(goal)
        .where(eq(goal.active, true))
        .orderBy(desc(goal.createdAt), desc(goal.id))
        .limit(1);
      return row;
    },

    async activeSlots(): Promise<TrainingSlotRow[]> {
      return db
        .select()
        .from(trainingSlot)
        .where(eq(trainingSlot.active, true))
        .orderBy(asc(trainingSlot.weekday), asc(trainingSlot.start));
    },

    /** Adds a training slot. Times are local HH:MM and `end` must be after `start`. */
    async addSlot(input: {
      weekday: unknown;
      start: unknown;
      end: unknown;
      kind: unknown;
    }): Promise<TrainingSlotRow> {
      const wd = input.weekday;
      if (typeof wd !== 'number' || !Number.isInteger(wd) || wd < 1 || wd > 7) {
        throw new ProfileInputError('weekday must be an integer from 1 (Mon) to 7 (Sun)');
      }
      const start = input.start;
      const end = input.end;
      if (typeof start !== 'string' || !TIME_RE.test(start)) {
        throw new ProfileInputError('start must be HH:MM');
      }
      if (typeof end !== 'string' || !TIME_RE.test(end)) {
        throw new ProfileInputError('end must be HH:MM');
      }
      if (end <= start) throw new ProfileInputError('end must be after start');
      const [row] = await db
        .insert(trainingSlot)
        .values({
          weekday: wd,
          start,
          end,
          kind: text(input.kind, 'kind', MAX_TEXT, true) as string,
        })
        .returning();
      return row;
    },
  };
}
