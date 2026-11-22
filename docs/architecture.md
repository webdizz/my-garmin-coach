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

## Principles

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
