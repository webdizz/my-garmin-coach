# Decision log

Format: **Decision** / **Why** / **Status**.

## D1. Web (PWA) over native iOS for now

- **Why:** native SwiftUI needs a paid Apple developer account ($99/yr), and free sideloaded builds expire
  after 7 days. A PWA on iOS 16.4+ covers the need as a home-screen app. Data comes from Garmin, not
  the phone, so HealthKit is not required.
- **Status:** accepted. Capacitor wrap remains an option later.

## D2. Next.js (TypeScript) as the app framework

- **Why:** UI and API routes in one project, mature ecosystem, good PWA story. User asked about it
  directly and it fits.
- **Status:** accepted, pending scaffold.

## D3. Garmin Personal API over unofficial login libraries

- **Why:** official, pull-only, personal key, no username/password in the app. Covers sleep, HRV, weight,
  activities and FIT files according to the Swagger page.
- **Verified (GC-2, 2026-11-23):** auth, base URL, sleep, HRV, resting HR, VO2max, weight/BMI, HR zones,
  activities (with training effect and load), body battery, stress and FIT download all work. See
  `docs/garmin-api.md`.
- **Risk:** history is about 1 year, so sync and store locally from day one. Rate limits undocumented.
  No endpoint found for training status or training readiness. Body composition is null for manual weight entries.
- **Fallback:** `python-garminconnect` / `garth` (unofficial, login-based) if the Personal API is missing
  a needed metric.
- **Status:** accepted. **GO**, with the gaps above. Revisit the fallback only if training status becomes a
  must-have.

## D4. Agent layer: open

Candidates under evaluation:

- **Vercel AI SDK:** mature, provider-agnostic, but the user finds its API custom rather than standard.
- **`@earendil-works/pi-agent-core` + `pi-ai`:** embeddable agent runtime with tool execution and event
  streaming. Built on a unified multi-provider LLM layer. Less common in web apps; check maturity.
- **`@anthropic-ai/claude-agent-sdk`:** Anthropic's agent SDK. Tied to Claude.
- **Standard protocols** the user prefers: A2A (agent-to-agent), AG-UI (agent-to-UI event streams),
  A2UI (declarative agent-generated UI).
- **Status:** open. Decide after a small spike: one tool (`get_metrics`) wired to real data.

## D5. A2UI as candidate for rich agent UI

- **Why:** declarative JSON-schema UI from agents, no arbitrary code execution, has a React renderer.
- **Caveats:** `@a2ui/react` latest is `0.15.0`, which is pre-1.0 even though the spec page is labelled v1.0.
  Expect breaking changes. Renderer maturity must be checked.
- **Status:** candidate, deferred. Revisit once key capabilities (charts, sync, basic chat) exist.

## D6. Build key capabilities before UI design

- **Why:** user preference. Start with data sync, storage and a few metric tools; then design the UI.
- **Status:** accepted.

## D7. Single-user login before any data screen

- **Why:** the app holds health data and a Garmin personal key. Even on a private host it needs an
  authentication gate. The Garmin key stays on the server and is never sent to the browser.
- **Shape (mockup):** unlock with Face ID (passkey) as the default, password as fallback. Auto-lock after
  5 min. Banners for Garmin key expiring (≤ 14 days) and expired.
- **Status:** login screen accepted. Passkey + password fallback is the proposed method, to be confirmed.

## D8. Coach uses one thread per plan week

- **Why:** keeps token use bounded and gives a natural review point. Older weeks collapse to a summary
  the coach carries forward. Full history is not replayed.
- **Rules:** new thread on Monday. The Monday summary opens the thread and covers the previous week's review
  and the proposed plan. There is no separate Sunday review thread.
- **Status:** accepted.

## D9. Questions go to the current week's thread

- **Why:** a question such as "why is my HRV low?" belongs to the current context. History is fetched by tool
  when needed, so no new thread is required.
- **Status:** accepted.

## D10. Past weeks are attached explicitly, never silently

- **Why:** the user decides when older context is worth its token cost.
- **Shape:** "Attach" adds a past week to the next message only, as summary, full thread or metrics only.
  The token cost is shown before sending. A "Context" view lists exactly what is sent.
- **Status:** accepted.

## D11. Suggested plan changes need confirmation

- **Why:** weather and recovery can trigger a swap, but the user owns the plan. Suggestions are shown as
  Apply / Keep. Nothing changes silently.
- **Status:** accepted (mockup).

## D12. Database: async SQLite (libsql/turso) + Drizzle + ULID

- **Async driver:** `@libsql/client` (libsql.org) instead of `better-sqlite3`. Preserves the Node.js event loop; queries run on a thread pool. Supports local mode (dev) and Turso cloud (prod/backup).
- **Why async:** better-sqlite3 blocks the event loop while queries run. For small queries (ms) it's negligible, but bulk Garmin backfill, FTS5 reindexing, and multi-year aggregations would stall requests. Async avoids that cost.
- **ORM:** Drizzle. Schema and migrations are dialect-agnostic; switching to Postgres later means changing `sqliteTable` → `pgTable` and regenerating migrations, but no code rewrites.
- **IDs:** ULID (monotonic factory) instead of UUIDs. Smaller (26 chars vs 36), sortable by creation time, native TypeScript support (`ulid` package v3+). Store as `text(26)` with `$defaultFn(() => ulid())`.
- **FTS5:** SQLite native for chat/notes search. Upgrade to `pgvector` + embeddings later if needed.
- **Status:** accepted. Implements GC-6 (DB foundation).

## Open questions

1. Which agent layer? (D4)
2. Hosting: home machine + Tailscale, or managed platform?
3. Charting library: ECharts, Recharts or uPlot?
4. Is the Personal API sufficient for body composition and FIT parsing?
5. Which LLM provider(s), and what data-sharing policy is acceptable for health data?
6. Login method: passkey + password fallback (D7), or password only?
7. Readiness score on Today: use Garmin's own training readiness, or compute one from HRV, sleep and RHR?
8. Weather source and forecast horizon for the plan (the mockup assumes a 6-hourly re-check).
9. Monday summary: generated automatically at 07:00, or on demand?
10. Per-message and per-week token budget for the coach. Is there a hard cap?
11. Chat search: SQLite full-text search, or embeddings later?
