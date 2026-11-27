import type { Db } from '../db/client';
import { rawJsonRepo } from '../db/repos/raw-json';
import { syncRunRepo } from '../db/repos/sync-run';
import type { SyncRunRow } from '../db/schema';
import { GarminApiError, GarminKeyInvalidError, type GarminClient } from '../garmin/client';
import { isRateLimited, withBackoff, type BackoffOptions } from './backoff';
import { addDays, KIND_SPECS, type KindSpec, type PullContext } from './pull';

type SyncTrigger = SyncRunRow['trigger'];

const SYNC_SOURCE = 'garmin';
/** Recent days are re-pulled because Garmin revises them (sleep scores, HRV) after the fact. */
export const DEFAULT_DAYS = 3;
/** Garmin keeps about a year of history. */
export const MAX_DAYS = 365;
/** Range endpoints fail above ~400 days; 90 is verified (docs/garmin-api.md). */
const CHUNK_DAYS = 90;
const MAX_ERROR_LENGTH = 500;
/** Fixed text: never the response body or anything that could carry the key. */
const KEY_INVALID_MESSAGE = 'Garmin rejected the API key (401)';

interface SyncOutcome {
  runId: string;
  status: 'success' | 'error';
  /** Number of day-payloads written (inserted or overwritten). */
  stored: number;
  error?: string;
  /** Set when Garmin rejected the key, so the UI can say so and the scheduler can back off. */
  errorCode?: 'keyInvalid';
}

export interface SyncServiceOptions {
  db: Db;
  client: GarminClient;
  now?: () => Date;
  retry?: BackoffOptions;
  specs?: readonly KindSpec[];
}

export interface SyncService {
  isRunning(): boolean;
  /** Start a pull. Resolves `null` without doing anything when one is already running. */
  run(trigger: SyncTrigger, options?: { days?: number }): Promise<SyncOutcome | null>;
}

/** Split [from, to] into consecutive windows of at most `size` days. */
function windows(from: Date, to: Date, size: number): [Date, Date][] {
  const out: [Date, Date][] = [];
  for (let start = from; start.getTime() <= to.getTime(); start = addDays(start, size)) {
    const end = addDays(start, size - 1);
    out.push([start, end.getTime() > to.getTime() ? to : end]);
  }
  return out;
}

/**
 * Short, safe description of an error for the run record and logs. Drizzle puts the bound SQL
 * parameters (health data) into `message`, so use the driver cause when there is one.
 */
export function describeError(err: unknown): string {
  if (err instanceof GarminApiError) return err.message;
  const cause = err instanceof Error ? err.cause : undefined;
  if (cause instanceof Error) return cause.message;
  if (err instanceof Error && err.message.startsWith('Failed query:'))
    return 'database query failed';
  return err instanceof Error ? err.message : 'unknown error';
}

export function createSyncService(options: SyncServiceOptions): SyncService {
  const { db, client, specs = KIND_SPECS } = options;
  const now = options.now ?? (() => new Date());
  const raw = rawJsonRepo(db);
  const runs = syncRunRepo(db);
  const retry = <T>(fn: () => Promise<T>) => withBackoff(fn, options.retry);

  async function execute(trigger: SyncTrigger, days: number): Promise<SyncOutcome> {
    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
      throw new RangeError(`days must be an integer from 1 to ${MAX_DAYS}`);
    }
    const run = await runs.start(trigger);
    console.info(`[sync] run ${run.id} (${trigger}) started: last ${days} days`);
    const current = now();
    const today = new Date(current.getFullYear(), current.getMonth(), current.getDate());
    const spans = windows(addDays(today, -(days - 1)), today, CHUNK_DAYS);
    const errors: string[] = [];
    // Pull-level warnings (e.g. a truncated list) go into the run error so they are visible.
    const ctx: PullContext = { client, retry, warn: (message) => errors.push(message) };
    let stored = 0;
    // A rate limit or a rejected key stops the run: retrying in the same run cannot succeed.
    let stopRun = false;
    let keyInvalid = false;

    // Newest window first: recent days (the ones the UI shows) are stored first. A stop leaves only
    // the oldest days of the kind in progress for the next run.
    const newestFirst = [...spans].reverse();
    for (const spec of specs) {
      if (stopRun) break;
      for (const [i, [from, to]] of newestFirst.entries()) {
        if (spec.latestOnly && i > 0) continue;
        try {
          for (const [date, payload] of await spec.pull(ctx, from, to)) {
            await raw.upsert({ source: SYNC_SOURCE, kind: spec.kind, date }, payload);
            stored++;
          }
        } catch (err) {
          if (err instanceof GarminKeyInvalidError) {
            keyInvalid = true;
            errors.push(KEY_INVALID_MESSAGE);
          } else {
            errors.push(`${spec.kind}: ${describeError(err)}`);
          }
          stopRun = keyInvalid || isRateLimited(err);
          break;
        }
      }
    }

    const error = errors.length ? errors.join('; ').slice(0, MAX_ERROR_LENGTH) : undefined;
    const errorCode = keyInvalid ? 'keyInvalid' : undefined;
    await runs.finish(run.id, error === undefined ? {} : { error, errorCode });
    if (error === undefined)
      console.info(`[sync] run ${run.id} (${trigger}) success: ${stored} day-payloads stored`);
    else console.error(`[sync] run ${run.id} (${trigger}) error: ${error}`);
    return {
      runId: run.id,
      status: error === undefined ? 'success' : 'error',
      stored,
      error,
      errorCode,
    };
  }

  let inflight: Promise<SyncOutcome> | undefined;

  return {
    isRunning: () => inflight !== undefined,
    run(trigger, opts = {}) {
      if (inflight) return Promise.resolve(null);
      const p = execute(trigger, opts.days ?? DEFAULT_DAYS).finally(() => {
        inflight = undefined;
      });
      inflight = p;
      return p;
    },
  };
}
