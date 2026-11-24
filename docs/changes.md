# Recent changes

Per-ticket log of what landed, with gotchas. Newest first. Not required reading for every task:
open the entry for the area you are touching.

## GC-9: Sync job (scheduled pulls + manual refresh)

**Added:**

- `src/sync/`: pull specs per Garmin kind (`pull.ts`), retry/backoff (`backoff.ts`), run service with single in-flight guard (`run.ts`), scheduler with catch-up (`scheduler.ts`), slots 09:30 / 18:00 / 23:30 local (`slots.ts`), status for the banner (`status.ts`)
- `src/instrumentation.ts` starts the scheduler once per server process (skipped when `GARMIN_CONNECT_API_KEY` is unset)
- `GET /api/sync` (state, last run, last success, next pull) and `POST /api/sync` (manual refresh, 202 / 409 / 400)
- `syncRunRepo.interruptRunning()` and `syncRunRepo.lastSuccess()`
- Synthetic-data tests in `src/sync/__tests__/sync.test.ts`

**Gotchas:**

- Runs left `running` by a restart are marked `error: interrupted` at startup
- Default window is the last 3 days (Garmin revises recent data); range calls are chunked to 90 days
- A 429 that survives retries stops the run; the oldest-first order keeps recent days for the next run
- Pull kinds beyond those verified in `docs/garmin-api.md` are not yet checked against real responses

## GC-8: Garmin client (token exchange and typed fetchers)

**Added:**

- `src/garmin/client.ts`: `createGarminClient()` with `GarminClient` methods for each verified endpoint
- Token: `ApiKey` exchange → raw JWT, cached 24 h minus 10 min, one shared in-flight exchange, re-exchange once on 401
- Dates are `Date` objects read as local calendar days (`formatDay()` → `YYYY-MM-DD`); methods are `async`
- Host guard: HTTPS and `personal.connectapi.garmin.com` only, checked in the default transport and on every URL
- `GarminApiError` carries status and path, never the response body or key
- Offline tests with a stub fetch (no real key or health data)

**Gotchas:**

- Weight `latestWeight.weight` is grams, not kg
- `hrvDay()` returns `null` on 204 (no data for that day)

## GC-6: Database Foundation (async SQLite + Drizzle)

**Added:**

- `src/db/` module with schema, client factory, migration runner
- Async `@libsql/client` driver (preserves event loop)
- Drizzle ORM with SQLite schema (migration path to Postgres)
- ULID monotonic IDs for all tables
- Three base tables: raw_json, sync_run, settings
- Typed repository layer (rawJsonRepo, syncRunRepo, settingsRepo)
- In-memory test helper (`createTestDb()`)
- Migration generation with `npm run db:generate`
- 6 synthetic-data tests in `src/db/__tests__/repos.test.ts`

**Configuration:**

- Dev server fixed on port 3344 (`npm run dev`)
- Drizzle config in `drizzle.config.ts`
- Migrations stored in `drizzle/`
- `/data/` gitignored (local SQLite database)
