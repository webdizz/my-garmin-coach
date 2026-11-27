/** @jest-environment node */
import {
  createGarminClient,
  formatDay,
  GarminApiError,
  GarminKeyInvalidError,
  guardedFetch,
  REQUEST_TIMEOUT_MS,
  resolveBaseUrl,
  type FetchLike,
} from '../client';

const BASE = 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/** Scripted fake: records every call and answers from a route table. Synthetic data only. */
function fakeFetch(routes: Record<string, () => Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname + new URL(url).search;
    const key = Object.keys(routes).find((k) => path.startsWith(k));
    if (!key) throw new Error(`unexpected call ${path}`);
    return routes[key]();
  };
  return { fetch, calls };
}

describe('createGarminClient auth', () => {
  it('exchanges the API key once and reuses the token across calls', async () => {
    const { fetch, calls } = fakeFetch({
      [TOKEN_PATH]: () => new Response('jwt-token-1'),
      '/weight-service': () => json({ dailyWeightSummaries: [] }),
      '/hrv-service': () => json({ hrvSummaries: [] }),
    });
    const client = createGarminClient({ apiKey: 'k', fetch });

    await client.weightRange(new Date(2026, 0, 1), new Date(2026, 0, 7));
    await client.hrvRange(new Date(2026, 0, 1), new Date(2026, 0, 7));

    const tokenCalls = calls.filter((c) => c.url.endsWith(TOKEN_PATH));
    expect(tokenCalls).toHaveLength(1);
    expect(tokenCalls[0].init?.headers).toEqual({ Authorization: 'ApiKey k' });
    const dataCalls = calls.filter((c) => !c.url.endsWith(TOKEN_PATH));
    expect(
      dataCalls.every(
        (c) => (c.init?.headers as Record<string, string>).Authorization === 'Bearer jwt-token-1'
      )
    ).toBe(true);
  });

  it('re-exchanges the token after the 24 h TTL has passed', async () => {
    let t = 0;
    let issued = 0;
    const { fetch, calls } = fakeFetch({
      [TOKEN_PATH]: () => new Response(`jwt-${++issued}`),
      '/weight-service': () => json({ dailyWeightSummaries: [] }),
    });
    const client = createGarminClient({ apiKey: 'k', fetch, now: () => t });

    await client.weightRange(new Date(2026, 0, 1), new Date(2026, 0, 2));
    t += 23 * 60 * 60 * 1000;
    await client.weightRange(new Date(2026, 0, 1), new Date(2026, 0, 2));
    expect(calls.filter((c) => c.url.endsWith(TOKEN_PATH))).toHaveLength(1);

    t += 1 * 60 * 60 * 1000 + 1; // past 24 h minus the safety margin
    await client.weightRange(new Date(2026, 0, 1), new Date(2026, 0, 2));
    expect(calls.filter((c) => c.url.endsWith(TOKEN_PATH))).toHaveLength(2);
  });

  it('re-requests a token once on 401 and retries the call', async () => {
    let tokenIssued = 0;
    let dataCalls = 0;
    const { fetch } = fakeFetch({
      [TOKEN_PATH]: () => new Response(`jwt-${++tokenIssued}`),
      '/weight-service': () =>
        ++dataCalls === 1 ? new Response('', { status: 401 }) : json({ dailyWeightSummaries: [] }),
    });
    const client = createGarminClient({ apiKey: 'k', fetch });

    await expect(client.weightRange(new Date(2026, 0, 1), new Date(2026, 0, 2))).resolves.toEqual({
      dailyWeightSummaries: [],
    });
    expect(tokenIssued).toBe(2);
    expect(dataCalls).toBe(2);
  });

  it('shares one in-flight token exchange between concurrent callers', async () => {
    let tokenIssued = 0;
    const { fetch } = fakeFetch({
      [TOKEN_PATH]: () => new Response(`jwt-${++tokenIssued}`),
      '/weight-service': () => json({ dailyWeightSummaries: [] }),
      '/hrv-service': () => json({ hrvSummaries: [] }),
    });
    const client = createGarminClient({ apiKey: 'k', fetch });

    await Promise.all([
      client.weightRange(new Date(2026, 0, 1), new Date(2026, 0, 2)),
      client.hrvRange(new Date(2026, 0, 1), new Date(2026, 0, 2)),
    ]);
    expect(tokenIssued).toBe(1);
  });

  it('throws GarminApiError with status and path only, never the body or key', async () => {
    const { fetch } = fakeFetch({
      [TOKEN_PATH]: () => new Response('jwt'),
      '/weight-service': () => new Response('secret health body', { status: 500 }),
    });
    const client = createGarminClient({ apiKey: 'super-secret-key', fetch });

    const err = await client
      .weightRange(new Date(2026, 0, 1), new Date(2026, 0, 2))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GarminApiError);
    expect((err as GarminApiError).status).toBe(500);
    expect((err as Error).message).not.toContain('secret health body');
    expect((err as Error).message).not.toContain('super-secret-key');
  });
});

describe('createGarminClient failure paths', () => {
  const range = [new Date(2026, 0, 1), new Date(2026, 0, 2)] as const;

  it('gives up after a second 401 instead of looping', async () => {
    let dataCalls = 0;
    const { fetch } = fakeFetch({
      [TOKEN_PATH]: () => new Response('jwt'),
      '/weight-service': () => (++dataCalls, new Response('', { status: 401 })),
    });
    const client = createGarminClient({ apiKey: 'k', fetch });
    const err = await client.weightRange(...range).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GarminApiError);
    expect((err as GarminApiError).status).toBe(401);
    expect(dataCalls).toBe(2);
  });

  it('retries the token exchange after a failed one', async () => {
    let tokenCalls = 0;
    const { fetch } = fakeFetch({
      [TOKEN_PATH]: () =>
        ++tokenCalls === 1 ? new Response('', { status: 503 }) : new Response('jwt'),
      '/weight-service': () => json({ dailyWeightSummaries: [] }),
    });
    const client = createGarminClient({ apiKey: 'k', fetch });
    await expect(client.weightRange(...range)).rejects.toBeInstanceOf(GarminApiError);
    await expect(client.weightRange(...range)).resolves.toEqual({ dailyWeightSummaries: [] });
    expect(tokenCalls).toBe(2);
  });

  it('rejects an empty token body', async () => {
    const { fetch } = fakeFetch({ [TOKEN_PATH]: () => new Response('  ') });
    const client = createGarminClient({ apiKey: 'k', fetch });
    await expect(client.weightRange(...range)).rejects.toBeInstanceOf(GarminApiError);
  });

  it('turns an unexpected 204 into GarminApiError, not a JSON SyntaxError', async () => {
    const { fetch } = fakeFetch({
      [TOKEN_PATH]: () => new Response('jwt'),
      '/weight-service': () => new Response(null, { status: 204 }),
    });
    const client = createGarminClient({ apiKey: 'k', fetch });
    const err = await client.weightRange(...range).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GarminApiError);
    expect((err as GarminApiError).status).toBe(204);
  });
});

describe('createGarminClient endpoints', () => {
  const routes = () => ({
    [TOKEN_PATH]: () => new Response('jwt'),
    '/hrv-service/hrv/': () => new Response(null, { status: 204 }),
    '/sleep-service/': () => json([]),
    '/wellness-service/wellness/dailyHeartRate': () => json({ restingHeartRate: 50 }),
    '/usersummary-service/usersummary/daily': () => json({ totalSteps: 1000 }),
    '/activitylist-service/': () => json([]),
  });

  it('returns null for a day with no HRV data (204)', async () => {
    const { fetch } = fakeFetch(routes());
    const client = createGarminClient({ apiKey: 'k', fetch });
    await expect(client.hrvDay(new Date(2026, 0, 3))).resolves.toBeNull();
  });

  it('builds the verified paths and query strings', async () => {
    const { fetch, calls } = fakeFetch(routes());
    const client = createGarminClient({ apiKey: 'k', fetch });

    await client.sleepRange(new Date(2026, 0, 1), new Date(2026, 0, 7));
    await client.restingHeartRate(new Date(2026, 0, 3));
    await client.dailySummary(new Date(2026, 0, 3));
    await client.activities({
      limit: 5,
      startDate: new Date(2026, 0, 1),
      endDate: new Date(2026, 0, 31),
    });

    const paths = calls
      .filter((c) => !c.url.endsWith(TOKEN_PATH))
      .map((c) => new URL(c.url).pathname + new URL(c.url).search);
    expect(paths).toEqual([
      '/sleep-service/sleep/dailySleepSummariesByDate?startDate=2026-01-01&endDate=2026-01-07',
      '/wellness-service/wellness/dailyHeartRate?date=2026-01-03',
      '/usersummary-service/usersummary/daily?calendarDate=2026-01-03',
      '/activitylist-service/activities/search/activities?start=0&limit=5&startDate=2026-01-01&endDate=2026-01-31',
    ]);
  });

  it('rejects invalid dates before any network call', async () => {
    const { fetch, calls } = fakeFetch(routes());
    const client = createGarminClient({ apiKey: 'k', fetch });
    await expect(client.hrvDay(new Date('nope'))).rejects.toThrow(RangeError);
    await expect(client.hrvRange(new Date(2026, 0, 1), '../x' as unknown as Date)).rejects.toThrow(
      RangeError
    );
    expect(calls).toHaveLength(0);
  });
});

describe('formatDay', () => {
  it('formats the local calendar day with zero padding', () => {
    expect(formatDay(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(formatDay(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('host allowlist', () => {
  it('accepts the Garmin personal host over HTTPS', () => {
    expect(resolveBaseUrl(BASE)).toBe(BASE);
  });

  it('refuses other hosts and plain HTTP', () => {
    expect(() => resolveBaseUrl('https://evil.example.com')).toThrow(/not allowed/);
    expect(() => resolveBaseUrl('http://personal.connectapi.garmin.com')).toThrow(/not allowed/);
  });

  it('reduces a base URL with a path or credentials to its origin', () => {
    expect(resolveBaseUrl(`https://user:pw@personal.connectapi.garmin.com/x?y=1`)).toBe(BASE);
  });

  it('sends requests with redirect:error and a timeout signal', async () => {
    const realFetch = global.fetch;
    const spy = jest.fn().mockResolvedValue(new Response('ok'));
    global.fetch = spy;
    try {
      await guardedFetch(`${BASE}/x`, { headers: { a: 'b' } });
      const init = spy.mock.calls[0][1] as RequestInit;
      expect(init.redirect).toBe('error');
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    } finally {
      global.fetch = realFetch;
    }
  });

  it('default transport refuses foreign hosts before any network call', async () => {
    const realFetch = global.fetch;
    const spy = jest.fn();
    global.fetch = spy;
    try {
      await expect(guardedFetch('https://evil.example.com/x', {})).rejects.toThrow(/not allowed/);
      await expect(guardedFetch('http://personal.connectapi.garmin.com/x', {})).rejects.toThrow(
        /not allowed/
      );
      expect(spy).not.toHaveBeenCalled();
    } finally {
      global.fetch = realFetch;
    }
  });

  it('classifies a 401 on the token exchange as a rejected key, not a generic error', async () => {
    const { fetch } = fakeFetch({
      [TOKEN_PATH]: () => new Response('', { status: 401 }),
      '/weight-service': () => json({ dailyWeightSummaries: [] }),
    });
    const client = createGarminClient({ apiKey: 'k', fetch });
    const err = await client
      .weightRange(new Date(2026, 0, 1), new Date(2026, 0, 2))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(GarminKeyInvalidError);
    expect(err).toBeInstanceOf(GarminApiError);
    expect((err as GarminApiError).status).toBe(401);
  });
});
