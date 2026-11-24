# AGENTS.md

Guidance for AI coding agents working in this repository.

## Project

Personal web app (PWA-capable) that pulls the owner's Garmin Connect data, shows charts,
and offers an agentic assistant for training, fitness and health questions.
Single user. Not a multi-tenant product.

Current state: **early development.** Next.js scaffold complete (GC-6: DB foundation with async SQLite + Drizzle + ULID; GC-8: server-only Garmin client).
Read `docs/` before making decisions.

## Key decisions (see `docs/decisions.md`)

- **Stack direction:** Next.js (App Router, TypeScript). UI and API routes in one project.
- **Garmin data:** official **Garmin Connect Developer Program – Personal API** (personal API key,
  pull-only). Not the unofficial `garth` / `python-garminconnect` login scraping, unless the
  official route proves insufficient.
- **Agent layer:** undecided. Candidates: Vercel AI SDK, `@earendil-works/pi-agent-core`
  (+ `pi-ai`), `@anthropic-ai/claude-agent-sdk`, and A2UI for rich generative UI.
  The user wants standard protocols over custom glue.
- **UI:** deferred. Start with key capabilities first.
- **Platform:** iPhone use via PWA. Native iOS (SwiftUI) was considered and deprioritised.

## Working rules

- Do **not** read, print, copy or commit `.env` or any file containing the Garmin personal API key
  or other secrets. Reference variables by name only.
- Do **not** commit personal health exports (`~/Downloads/*.csv`) or any dump of real health data
  into the repo. Use synthetic or anonymised fixtures for tests.
- Garmin export CSVs are **Portuguese-localised** (headers like `Tempo`, `Peso`, `Braçada`).
  Parsers must handle localisation and the decimal/unit formats (e.g. `81.2 kg`, `6h 45m`, `--` for missing).
- Verify any Garmin endpoint, field name or auth header against a real response before relying on it.
  Endpoint paths listed in `docs/garmin-api.md` came from the Swagger JS bundle and are **unverified**.
- Health output is informational, not medical advice. The agent must cite the numbers it used and flag
  concerning signals (e.g. elevated resting HR, low HRV trend) with a suggestion to see a clinician.
- Prefer standard protocols and well-maintained libraries over custom abstractions.
- Keep changes small and reviewable. Ask before adding a dependency with heavy footprint.

## Verify before claiming

- Library versions and maturity (check npm registry / repo, not memory).
- Garmin API rate limits, history depth, and data scope (not yet confirmed).
- A2UI: React renderer `@a2ui/react` is at `0.15.0` (pre-1.0). The spec page is labelled v1.0. Treat as not yet stable.

## Memory

Project memory is stored via `memory_store` (project `garminconnect`). Update existing entries rather than duplicating.

## Commands

```bash
# Development
npm run dev              # Start dev server (http://localhost:3344)
npm run build            # Build for production
npm start               # Run production build

# Testing & Quality
npm run typecheck       # Run TypeScript type checking (tsc --noEmit)
npm run test            # Run tests in watch mode (Jest)
npm run test:ci         # Run tests with coverage (CI mode)
npm run test:coverage   # Full coverage report
npm run test:pre-commit # Fast test run (used by pre-commit hooks)
npm run lint            # Run ESLint on src/
npm run format          # Auto-fix formatting with Prettier
npm run format:check    # Check formatting without changing files
npm run verify          # Full suite: lint + typecheck + test:ci

# Database
npm run db:generate     # Generate Drizzle migrations
npm run db:migrate      # Apply migrations to the database
```

## Project Structure

```
src/
├── app/              # Next.js app router
├── db/               # Database layer (async SQLite + Drizzle)
│  ├── schema.ts      # Table definitions (raw_json, sync_run, settings)
│  ├── client.ts      # libsql/drizzle client factory
│  ├── id.ts          # ULID monotonic ID generator
│  ├── migrate.ts     # Migration runner
│  ├── testing.ts     # In-memory test DB helper
├── garmin/           # Garmin Personal API client (server-only)
│  ├── client.ts      # Token exchange, host allowlist, typed endpoints (Date in, Promise out)
│  ├── types.ts       # Response types (weight in grams, durations in seconds)
│  ├── index.ts       # getGarminClient(); reads GARMIN_CONNECT_API_KEY by name
│  └── __tests__/     # Offline tests, stub fetch, no real key or health data
│  ├── repos/         # Typed repository layer
│  └── __tests__/     # DB and repo tests
drizzle/             # Migration files (generated)
docs/                # Architecture, API docs, decisions, UI mockup
fixtures/            # Gitignored: personal Garmin exports
scripts/             # CI/quality scripts
```

### Design System

- Design tokens: `src/app/design-tokens.css` — dark, data-dense, mobile-first color palette and utilities
- Global styles: `src/app/globals.css` — imports design tokens and Tailwind
- Mobile viewport: 430px max-width, 900px max-height (enforced in CSS custom properties)

### Database (GC-6)

- **Driver:** `@libsql/client` (async SQLite; preserves Node.js event loop)
- **ORM:** Drizzle (dialect-agnostic; migration path to Postgres)
- **IDs:** ULID (26 chars, sortable by creation time)
- **Tables:**
  - `raw_json` — verbatim Garmin responses (source, kind, date, payload)
  - `sync_run` — sync history (trigger, status, error)
  - `settings` — typed key/value store (units, sync.hour, etc.)
- **Test helper:** `createTestDb()` for in-memory migrations
- **Repos:** Typed, one per table (rawJsonRepo, syncRunRepo, settingsRepo)
- **Environment:** `DATABASE_URL` (default `file:./data/app.db`)

## This is NOT the Next.js you know

## Git Hooks & Pre-commit Verification

**Automatic checks before every commit:**

Pre-commit hooks (via Husky) verify code quality automatically:

1. **ESLint** — lints staged files, fixes auto-fixable issues
2. **TypeScript** — full type checking (tsc --noEmit)
3. **Tests** — runs Jest with bail (stops on first failure)

**Workflow:**

```bash
git add <files>
git commit -m "message"
# → Hooks run automatically; commit is blocked if any check fails
# → Fix issues and retry
```

**Manual verification commands:**

```bash
# Full quality suite (lint + typecheck + test with coverage)
npm run verify

# Format code (Prettier)
npm run format              # Auto-fix formatting issues
npm run format:check        # Check without changing files

# Tests
npm run test:pre-commit     # Fast test run (used by hooks)
npm run test:coverage       # Full coverage report
npm run test                # Watch mode

# CI verification (for automated pipelines)
scripts/ci-verify.sh        # Full suite: format check + lint + typecheck + coverage
```

**Troubleshooting:**

If a hook blocks your commit:

- ESLint failure → `npm run lint` to see issues; `npm run format` to auto-fix
- TypeScript failure → Review error output; fix type errors manually
- Test failure → `npm run test:pre-commit` to debug; fix tests or code

To bypass hooks (not recommended):

```bash
git commit --no-verify   # Skips all hooks
```

## Recent changes

### GC-8: Garmin client (token exchange and typed fetchers)

**Added:**

- `src/garmin/client.ts`: `createGarminClient()` with `GarminClient` methods for each verified endpoint
- Token: `ApiKey` exchange → raw JWT, cached 24 h minus 10 min, one shared in-flight exchange, re-exchange once on 401
- Dates are `Date` objects read as local calendar days (`formatDay()` → `YYYY-MM-DD`); methods are `async`
- Host guard: HTTPS and `personal.connectapi.garmin.com` only, checked in the default transport and on every URL
- `GarminApiError` carries status and path, never the response body or key
- 22 offline tests

**Gotchas:**

- Weight `latestWeight.weight` is grams, not kg
- `hrvDay()` returns `null` on 204 (no data for that day)

### GC-6: Database Foundation (async SQLite + Drizzle)

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

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
