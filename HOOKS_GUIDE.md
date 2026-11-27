# Git Hooks & Quality Verification Guide

This document explains the automated quality checks in this project.

## ⚡ Quick Start

Just commit normally—Husky hooks will verify your code:

```bash
git add <files>
git commit -m "Your message"
# Hooks automatically run:
# 1. ESLint (staged files only)
# 2. TypeScript type check
# 3. Jest tests
# If anything fails, commit is blocked. Fix and retry.
```

## 🔍 What Gets Checked?

| Check          | Scope          | What it does            | Failure                               |
| -------------- | -------------- | ----------------------- | ------------------------------------- |
| **ESLint**     | Staged files   | Finds code style issues | Auto-fixes if possible, blocks if not |
| **Prettier**   | Staged files   | Checks formatting       | Auto-formats via lint-staged          |
| **TypeScript** | Entire project | Type checking           | Blocks commit                         |
| **Jest**       | All test files | Runs tests              | Blocks if tests fail                  |

## 📋 Available Commands

### Format Code

```bash
npm run format              # Auto-fix formatting issues
npm run format:check        # Check without changing files
```

### Run Quality Checks

```bash
npm run lint                # ESLint only
npm run typecheck           # TypeScript only
npm run test:pre-commit     # Jest (fast, no coverage)
npm run test:coverage       # Jest with coverage report
npm run verify              # Full suite: lint + typecheck + test:ci
```

### CI/CD Pipeline

```bash
scripts/ci-verify.sh        # Format check → lint → typecheck → coverage
```

### Development Mode

```bash
npm run test                # Jest watch mode (interactive)
npm run dev                 # Next.js dev server
```

## 🚫 Troubleshooting

### "ESLint found issues" → Commit blocked

**Solution:**

```bash
npm run format              # Auto-fixes most issues
git add .                   # Stage the fixes
git commit -m "Your message"
```

**If formatting isn't the issue:**

```bash
npm run lint                # See the actual issues
# Fix them manually, then retry commit
```

### "TypeScript errors" → Commit blocked

**Solution:**

1. Read the error message
2. Fix the type error in your code
3. Retry commit

```bash
npm run typecheck           # Debug the error
# Fix the issue, then
git add .
git commit -m "Your message"
```

### "Tests failed" → Commit blocked

**Solution:**

```bash
npm run test:pre-commit     # Run tests to debug
# Fix the failing test or the code it tests
git add .
git commit -m "Your message"
```

### "Need to bypass hooks?"

⚠️ **Not recommended**, but possible:

```bash
git commit --no-verify      # Skips ALL hooks
```

Use only for emergency hotfixes. Hooks exist to maintain code quality.

## 🔐 Secrets & Privacy Guards

Health data and secrets must never enter git. Three layers enforce this:

| Stage      | Check                                     | Blocks on                                                                                                               |
| ---------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| pre-commit | `gitleaks git --pre-commit --staged`      | secrets in staged changes                                                                                               |
| pre-commit | `scripts/guard-privacy.sh --staged`       | tracked `fixtures/`, `*.csv`, `.env`, `*.db`; Garmin-shaped payloads or Portuguese Garmin CSV headers in staged content |
| pre-push   | `npm audit --omit=dev --audit-level=high` | high/critical production advisories                                                                                     |
| pre-push   | `gitleaks git`                            | secrets anywhere in history                                                                                             |
| CI         | `scripts/ci-verify.sh`                    | all of the above, plus full-history gitleaks                                                                            |

- Install gitleaks once: `brew install gitleaks`. Hooks fail closed if it is missing.
- **`.gitleaks.toml`** extends the default rules with a Garmin API key rule. Generated output (`.next/`, `reports/`, `graphify-out/`) is allowlisted. Test files are scanned like any other file; tests must build secret-shaped values at runtime rather than use literals.
- **`scripts/guard-privacy.sh`** flags payloads with real values only. Schema placeholders such as `"calendarDate": "string"` pass.
- If the guard flags a real file: `git rm --cached <path>` and keep it in `.gitignore`.
- Moderate npm advisories are reported by `npm audit` but do not block pushes. Review them periodically.

## 🔧 Configuration Files

- **`.husky/pre-commit`** — Hook script that runs on every commit
- **`.prettierrc`** — Prettier config (100 char width, 2-space indent)
- **`.prettierignore`** — Files Prettier ignores
- **`eslint.config.mjs`** — ESLint config (included with Next.js)
- **`jest.config.js`** — Jest config (Next.js environment)
- **`jest.setup.ts`** — Jest setup (testing library imports)
- **`package.json` → `lint-staged`** — Runs linter + prettier on staged files
- **`.gitleaks.toml`** — Secret scanning rules and allowlist
- **`scripts/guard-privacy.sh`** — Fixture, CSV, `.env` and Garmin payload guard
- **`.github/dependabot.yml`** — Weekly dependency update PRs (npm and GitHub Actions)

## 📦 Dependencies

- **husky** — Git hooks framework
- **lint-staged** — Run linters on staged files only
- **prettier** — Code formatter
- **eslint** — Linter (from Next.js)
- **jest** — Test runner
- **@testing-library/react** — React testing utilities

## 🎯 Best Practices

1. **Keep commits small** — Easier to debug if something fails
2. **Write tests for new code** — Required for commits to pass
3. **Run `npm run verify` before pushing** — Catches issues early
4. **Fix formatting immediately** — `npm run format` is fast
5. **Use `npm run typecheck` during development** — Don't wait for commit hooks

## 📊 Performance

| Command                    | Time | Purpose                  |
| -------------------------- | ---- | ------------------------ |
| `npm run format`           | ~1s  | Format code              |
| `npm run lint`             | ~2s  | Lint check               |
| `npm run typecheck`        | ~2s  | Type check               |
| `npm run test:pre-commit`  | ~1s  | Fast test run            |
| `npm run verify`           | ~5s  | Full check with coverage |
| `.husky/pre-commit` (hook) | ~5s  | Full hook verification   |

The pre-commit hook is designed to be fast (no coverage) while still catching issues.
