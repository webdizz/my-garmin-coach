# Recent changes

Per-ticket log of what landed, with gotchas. Newest first. Not required reading for every task:
open the entry for the area you are touching.

## GC-35: Refactoring according to linters

**Added:**

- ESLint guardrails in `eslint.config.mjs`: client boundary (no `src/garmin`, `src/db`, `src/auth` imports from `'use client'`), `GARMIN_*` env reads only in `src/garmin/index.ts`, no `console.*` of tokens or payloads
- dependency-cruiser layer rules (`.dependency-cruiser.cjs`, `npm run arch`)
- gitleaks secret scan (`.gitleaks.toml`), privacy guard (`scripts/guard-privacy.sh`) on pre-commit and pre-push, Dependabot config
- knip unused-code gate, Drizzle drift check (`npm run db:check`), `format:check` and `next build` in the checks
- `npm run verify` is the single definition of done; `docs/definition-of-done.md` is the solo checklist
- `graphify-out/` excluded from git, Prettier, ESLint and knip

**Gotchas:**

- `test:ci` must pass `--coverage`, otherwise the coverage thresholds are not enforced
- Mutation (Stryker) is not part of `verify`; run it with `npm run mutation`
- `knip.json` ignores the `gitleaks` binary because it is a Homebrew binary, not an npm dependency
- Enrollment token travels in a query string; exclude query strings from any access log (see GC-7)

## GC-36: Coverage floors and on-demand mutation testing

**Added:** per-directory Jest coverage floors (`src/garmin`, `src/db`, `src/sync`, plus a global floor for the rest) set at the measured baseline, and Stryker 10 (`npm run mutation`, config in `stryker.config.mjs`) targeting the Garmin client and sync backoff/slots. `.graphifyignore` keeps health data and generated output out of the knowledge graph.

**Gotchas**

- Mutation testing is not part of `verify`. Stryker copies the repo into `.stryker-tmp/`; ESLint, Prettier and Jest ignore that folder. Without the ignores, lint reported about 690 false errors from the sandbox copies.
- `.stryker-tmp/`, `.stryker-cache/` and `reports/` are gitignored.
- Floors are baselines, not the 80% target. Raise them as tests land.

## GC-10: Garmin key expiry banners

**Added:**

- `src/you/key-expiry.ts`: `keyExpiry(expiresOn, today)` classifies the key as `unknown`, `ok`, `expiring` (≤ 14 days, `KEY_EXPIRY_WARN_DAYS`) or `expired`. A key is still valid on its expiry day. `parseKeyExpiry` validates input (`null` clears it).
- The expiry date is stored in `settings` as `garmin.keyExpiresOn` (YYYY-MM-DD). No migration.
- You screen: the Garmin key row shows days left and a date field (`KeyExpiryForm`, action `setKeyExpiry` on `POST /api/you`).
- Today: `KeyBanner` (`src/components/key-banner.tsx`) shows the amber expiring warning, or the rose expired alert with renewal steps. Today is now request-time (`connection()`), so the banner is never frozen at build time.
- `POST /api/sync` returns 409 `{error: "keyExpired"}` once the key date has passed, so no pull runs with a dead key.

**Gotchas:**

- Garmin's API does not report key expiry. The FAQ says the key is created with a 30, 90, 180 or 365 day lifetime, and Garmin emails about a week before. The 24 h Bearer token is not the key's lifetime, so the date has to be typed in from Garmin Connect (`connect.garmin.com/app/settings/personalApiToken`).
- Expiry is a manual date, so a key revoked early still shows as valid. A 401 from the token exchange is the only signal for that, and it is not handled by this ticket.
- The 409 guard compares against local today, using the same `localDay` as the You screen.

## GC-28 and GC-25: You screen (feeling, niggles, goal, slots, sync)

**Added:**

- Migration `0002_gc28_you_profile`: `daily_checkin` (one row per day), `niggle` (open until `resolvedOn`), `goal` (one active), `training_slot` (weekday 1-7, HH:MM)
- `youProfileRepo` in `src/db/repos/you-profile.ts`: validates input, throws `ProfileInputError` with the field name only
- `src/you/state.ts` loader (`getYouState`) and `/you` page with sections: Today, Niggles, Goal, Training slots, Data, Security, disclaimer
- `POST /api/you` with actions `feeling`, `addNiggle`, `resolveNiggle`, `setGoal`. Guarded like `/api/sync` (session, cross-site origin, validation)
- Bottom tab bar (`src/components/tab-nav.tsx`). Today and You are live, Plan, Trends and Coach are disabled until their tickets land

**Gotchas:**

- Not added in GC-28: `garmin_profile`, schedule settings and `garmin_key_status`. The key expiry came in GC-10, stored as a setting rather than a table.
- Pull times on the screen come from GC-9 (UTC 09:30, 18:00, 23:30), shown in local time. The mockup's 06:30/12:00/21:00 are not used.
- Client code must not import `src/db`. Feeling options are kept in `src/you/format.ts` and must match `FEELINGS` in `src/db/schema.ts`.
- Auto-lock stays 5 minutes, shown as text on the screen. Changing it means editing `AUTO_LOCK_MINUTES`.

## GC-7: Login gate

**Added:** passkey-only login (Face ID) with Better Auth 1.7 + `@better-auth/passkey`. `src/auth/` (config, enrollment tokens, gate rules, login status), `src/proxy.ts` (gate on every route), `/login`, `/enroll`, `/api/auth/[...all]`, `LockControls` (Lock now + 5 min idle lock), `npm run auth:enroll`. Auth tables live in `src/db/auth-schema.ts` (migration `0001`), separate from `settings`.

**Setup:** set `BETTER_AUTH_SECRET` (32+ random chars, `openssl rand -base64 32`) in `.env`. `APP_ORIGIN` defaults to `http://localhost:3344`. First device: run `npm run auth:enroll`, open the printed link, approve Face ID.

**Gotchas**

- The passkey is bound to the RP ID (hostname). `localhost` passkeys do not work on another hostname; change `APP_ORIGIN` and re-enroll. Browsers treat `http://localhost` as secure, so no certificate is needed in dev.
- No sign-up or password routes. The only way to add a credential is an enrollment link (hash stored, 15 min, single use) or an existing session.
- Enrollment token is kept out of the page load: it sits in the URL fragment (`/enroll#token`), which browsers never send to the server. The passkey client then sends it as a query string (`?context=<token>`) to `/api/auth/passkey/generate-register-options`, so it does appear in that request URL. Any access log or reverse-proxy log that records query strings would hold it. Limits: single use, 15 min expiry, hash-only storage. If a reverse proxy is added, exclude query strings from its access log.
- Passkey endpoints are rate-limited (20 requests per 60 s per client, `PASSKEY_RATE_LIMIT`). Better Auth enables its limiter only in production by default, so it is set explicitly in `config.ts`. The limiter keys on client IP; behind a proxy, configure `advanced.ipAddress` or all clients share one bucket.
- Expired enrollment tokens are deleted each time `npm run auth:enroll` runs.
- The dev script pins port 3344. `APP_ORIGIN` must include the port actually served: the origin check uses the full origin, so a different port fails. The RP ID is the hostname only. (300 s) slid forward by activity. `cookieCache` is off so Lock now revokes at once.
- `proxy.ts` fails closed. Route handlers must still call `requireSession(request)` (see `/api/sync`).
- `cacheComponents` is on: no `export const dynamic`; request-time reads go inside `<Suspense>`.
- Jest needs the ESM-only auth packages in `transformIgnorePatterns` (`jest.config.js`).
- Not tested here: a real Face ID ceremony on a device. Verified by unit tests and a live gate check only.

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
- Slots are UTC (09:30, 18:00, 23:30 UTC), but the days pulled come from the server's local calendar. On a non-UTC host the pull window shifts by the timezone offset
- Windows run newest-first, so recent days are stored before older ones. A 429 that survives retries stops the run and leaves only the oldest days of that kind for the next run
- Activity lists stop after 20 pages (2000 entries). Hitting that cap records a run error
- `Retry-After` from Garmin, when sent, replaces the computed backoff delay
- Pull kinds beyond those verified in `docs/garmin-api.md` are not yet checked against real responses

## GC-8: Garmin client (token exchange and typed fetchers)

**Added:**

- 22 offline tests (stub fetch, synthetic data)
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
