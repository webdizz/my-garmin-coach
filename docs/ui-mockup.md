# UI mockup

Clickable, mobile-first HTML prototype: [`mockup/index.html`](mockup/index.html).
Open it in a browser. All data is synthetic (no real health data). It is a design reference, not app code.

Visual direction: dark, data-dense, training-cockpit feel.

## Screens

| Tab | Purpose |
|---|---|
| Login | Single-user unlock. Shows Garmin key status and last sync. |
| Today | Readiness, recommended session with the reason behind it, overnight metrics (HRV, sleep, resting HR, VO₂max), signals and weather-driven suggestions. |
| Plan | Week strip, session of the selected day with slot and forecast, apply/keep prompt for suggested changes, weekly load chart. |
| Trends | HRV, VO₂max, training load (acute vs chronic), resting HR. Segmented range: 7D / 30D / 90D / 1Y. Activities list with detail sheet. |
| Coach | Weekly threads with an AI coach. Segments: This week / Last week / Weeks / Search. |
| You | Current state (feeling, niggles, goal), Garmin-pulled data, training slots, background schedule, security. |

### Login

- One user. Unlock with Face ID (passkey), password as fallback.
- Banner states: Garmin key expiring (≤ 14 days) and Garmin key expired (blocks data refresh, shows renewal steps).
- Mockup states can be switched from the login screen footer (default, failed, key 12 d, key expired).

### Today

- Recommendation always states its reason and cites the numbers used (for example HRV vs 7-day baseline).
- Health signals carry a "see a clinician" note and an "informational, not medical advice" disclaimer.

### Plan

- Weather changes appear as a suggested swap that the user applies or keeps. Nothing changes silently.

### Trends

- Same segmented-control pattern as Coach (see below) for consistency.
- Charts show the normal range as a shaded band where a baseline exists (for example HRV).

### Coach

- **One thread per plan week.** A new thread opens on Monday.
- **Monday summary** opens the new thread. It covers last week's review and the proposed next-week plan. There is no separate Sunday thread.
- **Questions stay in the current week's thread**, for example "why is my HRV low?". The coach fetches history through tools instead of starting a new thread.
- **Segments:**
  - *This week*: the active thread, with a "Coach is reading" meter showing the context size in tokens.
  - *Last week*: read-only review of the previous week, with options to continue with a summary or the full thread.
  - *Weeks*: list of past weeks. Older weeks collapse to a short summary that the coach carries forward.
  - *Search*: full-text search over past chats. Results cost nothing until attached.
- **Attach past week** (＋ in composer): add a past week to the next message only, as:
  - summary (about +180 tokens),
  - full thread (about +2.1k tokens),
  - metrics only (about +320 tokens).
  The cost is shown before sending.
- **Coach memory:** short facts kept across weeks. Each is editable or deleted by the user. Auto-generated facts are marked.
- **Context transparency:** "Context" shows exactly what is sent with each message (system rules, profile, memory facts, plan, recent metrics, previous summary, this week's messages).

## Interaction rules

- Health and training claims show the metric, date range and value used.
- Suggested plan changes are never applied without user confirmation.
- Coach history is never replayed in full. Summaries and tools carry older context.
