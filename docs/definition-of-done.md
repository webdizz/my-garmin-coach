# Definition of done

Solo project, no PR process. Before merging or pushing work, tick this list.

- [ ] `npm run verify` exits 0. It runs: format:check, lint, typecheck, test:ci (coverage thresholds in `jest.config.js`), knip, arch (dependency-cruiser), db:check (Drizzle drift), secrets (gitleaks) and mutation (Stryker, break at 74%).
- [ ] No `--no-verify`. Hooks in `.husky/` ran on the commit.
- [ ] No new `.env`, `fixtures/`, CSV, `*.db` or Garmin-shaped payloads staged (`scripts/guard-privacy.sh --staged`).
- [ ] If `src/db/schema.ts` changed: `npm run db:generate` produced a migration and it is committed.
- [ ] Coverage did not drop below a threshold. If a threshold was raised by new tests, the new floor is in `jest.config.js`.
- [ ] Docs touched by the change are updated (`docs/changes.md` for ticketed work).

The rules behind these checks live in `AGENTS.md` under "Never do".
