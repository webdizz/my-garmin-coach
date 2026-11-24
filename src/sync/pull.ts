import { formatDay, GarminApiError, type GarminClient } from '../garmin/client';

export interface PullContext {
  client: GarminClient;
  /** Wraps every Garmin call with the retry/backoff policy. */
  retry: <T>(fn: () => Promise<T>) => Promise<T>;
}

/** How one Garmin data kind is pulled: a map of local day (YYYY-MM-DD) to the verbatim payload for that day. */
export interface KindSpec {
  kind: string;
  /** Not date-bound (zones, fitness age): pulled once per run, stored under the run's last day. */
  latestOnly?: boolean;
  pull(ctx: PullContext, from: Date, to: Date): Promise<Map<string, unknown>>;
}

export function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  for (let d = from; d.getTime() <= to.getTime(); d = addDays(d, 1)) days.push(d);
  return days;
}

/** One payload per day, taken from an array response. */
function indexByDay<T>(items: T[], dayOf: (item: T) => string): Map<string, unknown> {
  return new Map(items.map((item) => [dayOf(item), item]));
}

/** Per-day endpoint. A 204 means Garmin has nothing for that day, so the day is skipped. */
async function perDay(
  ctx: PullContext,
  from: Date,
  to: Date,
  fetchDay: (date: Date) => Promise<unknown>
): Promise<Map<string, unknown>> {
  const out = new Map<string, unknown>();
  for (const day of eachDay(from, to)) {
    try {
      out.set(formatDay(day), await ctx.retry(() => fetchDay(day)));
    } catch (err) {
      if (err instanceof GarminApiError && err.status === 204) continue;
      throw err;
    }
  }
  return out;
}

const ACTIVITY_PAGE = 100;
const MAX_ACTIVITY_PAGES = 20;

export const KIND_SPECS: readonly KindSpec[] = [
  {
    kind: 'sleep',
    async pull({ client, retry }, from, to) {
      const items = await retry(() => client.sleepRange(from, to));
      return indexByDay(items, (s) => s.calendarDate);
    },
  },
  {
    kind: 'hrv',
    async pull({ client, retry }, from, to) {
      const { hrvSummaries } = await retry(() => client.hrvRange(from, to));
      return indexByDay(hrvSummaries, (s) => s.calendarDate);
    },
  },
  {
    kind: 'resting_hr',
    pull: (ctx, from, to) => perDay(ctx, from, to, (d) => ctx.client.restingHeartRate(d)),
  },
  {
    kind: 'daily_summary',
    pull: (ctx, from, to) => perDay(ctx, from, to, (d) => ctx.client.dailySummary(d)),
  },
  {
    kind: 'weight',
    async pull({ client, retry }, from, to) {
      const { dailyWeightSummaries } = await retry(() => client.weightRange(from, to));
      return indexByDay(dailyWeightSummaries, (w) => w.summaryDate);
    },
  },
  {
    kind: 'body_battery',
    async pull({ client, retry }, from, to) {
      return indexByDay(await retry(() => client.bodyBatteryRange(from, to)), (b) => b.date);
    },
  },
  {
    kind: 'stress',
    async pull({ client, retry }, from, to) {
      return indexByDay(await retry(() => client.stressRange(from, to)), (s) => s.calendarDate);
    },
  },
  {
    kind: 'vo2max',
    async pull({ client, retry }, from, to) {
      return indexByDay(
        await retry(() => client.vo2MaxRange(from, to)),
        (v) => v.generic.calendarDate
      );
    },
  },
  {
    /** Stored as an array per local start day (a day can hold several activities). */
    kind: 'activities',
    async pull({ client, retry }, from, to) {
      const byDay = new Map<string, unknown[]>();
      for (let page = 0; page < MAX_ACTIVITY_PAGES; page++) {
        const items = await retry(() =>
          client.activities({
            start: page * ACTIVITY_PAGE,
            limit: ACTIVITY_PAGE,
            startDate: from,
            endDate: to,
          })
        );
        for (const a of items) {
          const day = a.startTimeLocal.slice(0, 10);
          byDay.set(day, [...(byDay.get(day) ?? []), a]);
        }
        if (items.length < ACTIVITY_PAGE) break;
      }
      return byDay;
    },
  },
  {
    kind: 'hr_zones',
    latestOnly: true,
    async pull({ client, retry }, _from, to) {
      return new Map([[formatDay(to), await retry(() => client.heartRateZones())]]);
    },
  },
  {
    kind: 'fitness_age',
    latestOnly: true,
    async pull({ client, retry }, _from, to) {
      return new Map([[formatDay(to), await retry(() => client.fitnessAge(to))]]);
    },
  },
];
