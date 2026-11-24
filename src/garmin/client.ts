import type {
  ActivitySummary,
  BodyBatteryDay,
  DailyHeartRate,
  DailySummary,
  FitnessAge,
  HeartRateZones,
  HrvDay,
  HrvRange,
  SleepSummary,
  StressDay,
  Vo2MaxDay,
  WeightRange,
} from './types';

export const DEFAULT_BASE_URL = 'https://personal.connectapi.garmin.com';

/** Garmin's token is valid 24 h. Re-request a little early so no call starts with a dying token. */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const TOKEN_SAFETY_MS = 10 * 60 * 1000;

/** Hosts the API key and Bearer token may be sent to. Anything else is refused. */
const ALLOWED_HOSTS = new Set(['personal.connectapi.garmin.com']);

/** Default transport. Refuses any URL that is not HTTPS on an allowlisted host, so the key and token never leave Garmin. */
export async function guardedFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing request to host not allowed: ${url.hostname}`);
  }
  return fetch(url, init);
}

/** Validate the base URL: HTTPS and an allowlisted host. Returns the origin only. */
export function resolveBaseUrl(raw: string): string {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Garmin base URL host not allowed: ${url.hostname}`);
  }
  return url.origin;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface GarminClientOptions {
  /** Personal API key. Never logged or included in errors. */
  apiKey: string;
  baseUrl?: string;
  fetch?: FetchLike;
  now?: () => number;
}

/** Non-2xx response. Carries the status and endpoint path only, never the body (health data). */
export class GarminApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string
  ) {
    super(`Garmin API ${status} for ${path}`);
    this.name = 'GarminApiError';
  }
}

/**
 * Calendar days are `Date`s read in the caller's local time zone (Garmin `calendarDate` is the
 * user's local day), so build them with `new Date(2026, 0, 31)`, not from a UTC midnight string.
 * Only the year, month and day are used; the time of day is ignored.
 */
export interface GarminClient {
  hrvDay(date: Date): Promise<HrvDay | null>;
  hrvRange(from: Date, to: Date): Promise<HrvRange>;
  sleepRange(from: Date, to: Date): Promise<SleepSummary[]>;
  restingHeartRate(date: Date): Promise<DailyHeartRate>;
  heartRateZones(): Promise<HeartRateZones[]>;
  weightRange(from: Date, to: Date): Promise<WeightRange>;
  bodyBatteryRange(from: Date, to: Date): Promise<BodyBatteryDay[]>;
  stressRange(from: Date, to: Date): Promise<StressDay[]>;
  dailySummary(date: Date): Promise<DailySummary>;
  fitnessAge(date: Date): Promise<FitnessAge>;
  vo2MaxRange(from: Date, to: Date): Promise<Vo2MaxDay[]>;
  activities(params: {
    start?: number;
    limit?: number;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ActivitySummary[]>;
}

/** Local calendar day as `YYYY-MM-DD`, the format every Garmin date parameter uses. */
export function formatDay(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new RangeError('Expected a valid Date');
  }
  const y = String(date.getFullYear()).padStart(4, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Create a Garmin Personal API client. Server-only in practice: the key must never reach the browser.
 * Exchanges the API key for a 24 h Bearer token, caches it, and re-exchanges once on a 401.
 */
export function createGarminClient(options: GarminClientOptions): GarminClient {
  const baseUrl = resolveBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);
  const doFetch: FetchLike = options.fetch ?? guardedFetch;
  const now = options.now ?? Date.now;

  /** Build a request URL and refuse anything that does not stay on the allowlisted origin. */
  const urlFor = (path: string): string => {
    const url = new URL(path, baseUrl);
    if (url.origin !== baseUrl) throw new Error('Refusing request outside the Garmin origin');
    return url.toString();
  };

  let token: { value: string; expiresAt: number } | undefined;
  let inflight: Promise<string> | undefined;

  async function exchangeToken(): Promise<string> {
    const path = '/personalapitoken-service/personal-api/personal-api-key/token';
    const res = await doFetch(urlFor(path), {
      method: 'POST',
      headers: { Authorization: `ApiKey ${options.apiKey}` },
    });
    if (!res.ok) throw new GarminApiError(res.status, path);
    // Body is the raw JWT string, not JSON.
    const value = (await res.text()).trim();
    if (!value) throw new GarminApiError(res.status, path);
    token = { value, expiresAt: now() + TOKEN_TTL_MS - TOKEN_SAFETY_MS };
    return value;
  }

  function getToken(force = false): Promise<string> {
    if (!force && token && token.expiresAt > now()) return Promise.resolve(token.value);
    // Share one in-flight exchange between concurrent callers.
    inflight ??= exchangeToken().finally(() => {
      inflight = undefined;
    });
    return inflight;
  }

  async function get<T>(path: string, allowEmpty = false): Promise<T | null> {
    const call = (bearer: string) =>
      doFetch(urlFor(path), { headers: { Authorization: `Bearer ${bearer}` } });
    let res = await call(await getToken());
    if (res.status === 401) {
      res = await call(await getToken(true));
    }
    if (allowEmpty && res.status === 204) return null;
    if (!res.ok) throw new GarminApiError(res.status, path);
    return (await res.json()) as T;
  }

  return {
    async hrvDay(date) {
      return get<HrvDay>(`/hrv-service/hrv/${formatDay(date)}`, true);
    },
    async hrvRange(from, to) {
      return get<HrvRange>(
        `/hrv-service/hrv/daily/${formatDay(from)}/${formatDay(to)}`
      ) as Promise<HrvRange>;
    },
    async sleepRange(from, to) {
      return get<SleepSummary[]>(
        `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${formatDay(from)}&endDate=${formatDay(to)}`
      ) as Promise<SleepSummary[]>;
    },
    async restingHeartRate(date) {
      return get<DailyHeartRate>(
        `/wellness-service/wellness/dailyHeartRate?date=${formatDay(date)}`
      ) as Promise<DailyHeartRate>;
    },
    async heartRateZones() {
      return get<HeartRateZones[]>('/biometric-service/heartRateZones/v2') as Promise<
        HeartRateZones[]
      >;
    },
    async weightRange(from, to) {
      return get<WeightRange>(
        `/weight-service/weight/range/${formatDay(from)}/${formatDay(to)}`
      ) as Promise<WeightRange>;
    },
    async bodyBatteryRange(from, to) {
      return get<BodyBatteryDay[]>(
        `/wellness-service/wellness/bodyBattery/reports/daily?startDate=${formatDay(from)}&endDate=${formatDay(to)}`
      ) as Promise<BodyBatteryDay[]>;
    },
    async stressRange(from, to) {
      return get<StressDay[]>(
        `/usersummary-service/stats/stress/daily/${formatDay(from)}/${formatDay(to)}`
      ) as Promise<StressDay[]>;
    },
    async dailySummary(date) {
      return get<DailySummary>(
        `/usersummary-service/usersummary/daily?calendarDate=${formatDay(date)}`
      ) as Promise<DailySummary>;
    },
    async fitnessAge(date) {
      return get<FitnessAge>(
        `/fitnessage-service/fitnessage/v2/${formatDay(date)}`
      ) as Promise<FitnessAge>;
    },
    async vo2MaxRange(from, to) {
      return get<Vo2MaxDay[]>(
        `/metrics-service/metrics/maxmet/daily/${formatDay(from)}/${formatDay(to)}`
      ) as Promise<Vo2MaxDay[]>;
    },
    async activities({ start = 0, limit = 20, startDate, endDate }) {
      const q = new URLSearchParams({ start: String(start), limit: String(limit) });
      if (startDate) q.set('startDate', formatDay(startDate));
      if (endDate) q.set('endDate', formatDay(endDate));
      return get<ActivitySummary[]>(
        `/activitylist-service/activities/search/activities?${q.toString()}`
      ) as Promise<ActivitySummary[]>;
    },
  };
}
