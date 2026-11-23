# Architecture (planned, tentative)

Nothing is built yet. This is the working model.

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

- Pull Garmin data at 06:30, 12:00 and 21:00.
- Morning briefing ready at 07:00.
- Re-check weather against the plan every 6 h. Notify only on plan changes.
- Garmin key expiry check, with a warning at 14 days.

## Auth

- Single-user login gate in front of all routes (D7).
- Garmin personal key is read from the server environment only. It is never returned to the client.

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
