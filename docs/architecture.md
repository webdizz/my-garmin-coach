# Architecture (planned, tentative)

Built so far: database foundation (GC-6) and the Garmin client (GC-8). The rest is the working model.

## Components

```
┌──────────────┐   pull (scheduled + manual)   ┌────────────────────┐
│ Garmin       │ ────────────────────────────▶ │ Sync job           │
│ Personal API │   personal API key → OAuth2  │ (Next.js route /   │
└──────────────┘                               │  script)           │
                                               └─────────┬──────────┘
                                                         ▼
                                               ┌────────────────────┐
                                               │ Local store        │
                                               │ (SQLite, daily     │
                                               │  time series)      │
                                               └─────────┬──────────┘
                                                         │ read-only tools
                                                         ▼
┌──────────────┐   charts / chat / A2UI        ┌────────────────────┐
│ Next.js UI   │ ◀──────────────────────────── │ Agent layer        │
│ (PWA on iOS) │                               │ (TBD)              │
└──────────────┘                               └────────────────────┘
```

## Scheduled jobs (from the mockup)

- Pull Garmin data at 09:30, 18:00 and 23:30 UTC, plus manual refresh (`POST /api/sync`). Implemented in GC-9.
- Morning briefing ready at 07:00.
- Re-check weather against the plan every 6 h. Notify only on plan changes.
- Garmin key expiry check, with a warning at 14 days.

## Sync job (implemented, GC-9)

- `src/sync/`: pulls each kind into `raw_json` (upsert per source/kind/date, so re-runs never duplicate). Default window is the last 3 days; `days` up to 365 backfills in 90-day chunks.
- `src/instrumentation.ts` starts the scheduler once per server process (skipped when `GARMIN_CONNECT_API_KEY` is unset). On start it runs a catch-up pull if the latest slot passed without a success.
- Retries 429, 5xx and timeouts with exponential backoff (1 s, doubling, 3 retries). A 429 that exhausts retries ends the run as an error.
- One pull at a time. `sync_run` records trigger, status and error. Runs left `running` by a restart are marked `error: interrupted`.
- `GET /api/sync` returns `{state, lastRun, lastSuccessAt, nextPullAt}` for the SYNCED banner. `POST /api/sync` (optional `{days}`) returns 202, or 409 if already running.

## Auth

- Single-user login gate in front of all routes (D7).
- Garmin personal key is read from the server environment only. It is never returned to the client.

## Garmin client (implemented, GC-8)

- `src/garmin/`: server-only typed client for the Personal API. The key is exchanged for a 24 h Bearer token, which is cached and re-requested on 401.
- Dates are `Date` objects read as local calendar days; methods are `async` and return typed responses.
- Requests are restricted to `https://personal.connectapi.garmin.com` over HTTPS. Errors carry status and path only, never the body (health data) or key.

## Coach data model (planned)

- `coach_thread`: one row per plan week (`week_start`, `status`, `summary`, `summary_tokens`).
- `coach_message`: belongs to one thread. Stores role, content and token count.
- `coach_memory`: short facts with `source` (`user` | `auto`) and an editable flag.
- Context builder assembles, per message: system rules, profile, memory facts, current plan, last 14 days
  of metrics (compact), previous week summary, and this week's messages. It reports the token total.
- Attachments (past week as summary, full thread or metrics) are added to the next message only.
- Search runs over `coach_message` (see open question 11).

## Principles

- **Bounded context.** Each coach message carries a token budget. Older context comes from summaries and tools,
  never full history by default.
- **Agent sees tools, not raw dumps.** Tools such as `get_metrics(metric, range, agg)`,
  `get_activities(filter)`, `get_activity(id)`, `compare_periods(a, b)`, `training_load(range)`.
  Optional read-only SQL tool with a schema description.
- **Grounded answers.** Every health/training claim cites the metric, date range and value used.
- **Idempotent sync.** Re-pulling a day overwrites that day. Keep raw JSON for re-parsing.
- **Single user, private hosting.** Tailscale or similar; not public.
- **PWA first.** Same web app later wrapped by Capacitor if native features become necessary.

## Open items

- Database and migrations choice.
- Agent framework (see `decisions.md`).
- UI component library and charting (ECharts vs Recharts vs uPlot).
- Hosting (home machine + Tailscale vs managed).
- FIT file parsing library.
- Passkey (WebAuthn) library and fallback password storage (D7).
- Weather provider and forecast source for the plan.
- Readiness score source (see `decisions.md`, question 7).

UI reference: [`ui-mockup.md`](ui-mockup.md).
