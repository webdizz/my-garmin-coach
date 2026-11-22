# GarminConnect

A small personal web app to explore my own Garmin Connect data: charts, training and
fitness trends, and an AI assistant for questions about training, fitness and health.

> Status: **planning.** No application code yet. See [`docs/`](docs/) for the current understanding.

## Goals

1. Import and store my Garmin data (sleep, HRV, resting HR, stress, body battery, weight,
   activities including FIT files).
2. Show charts for trends and training load.
3. Provide an agentic assistant that answers questions grounded in my data and shows which
   numbers it used.
4. Usable on iPhone, as an installed PWA.

## Planned stack (tentative)

- **Next.js** (App Router, TypeScript): UI and API routes in one project.
- **Garmin Connect Developer Program – Personal API** for data (personal API key, pull-only).
- **Local database** (e.g. SQLite) for synced history.
- **Agent layer:** still to be chosen (see [`docs/decisions.md`](docs/decisions.md)).
- **Rich agent UI:** A2UI is a candidate. Deferred.

## Repository layout

```
AGENTS.md        Guidance for AI coding agents
README.md        This file
docs/            Project understanding: architecture, Garmin API, data exports, decisions
.env             Local secrets (not committed). Holds the Garmin personal API key.
```

## Local setup

Not yet defined. Will be documented once the Next.js scaffold exists.

## Privacy

Health data stays on my machine or my private host. Do not commit exports or `.env`.
