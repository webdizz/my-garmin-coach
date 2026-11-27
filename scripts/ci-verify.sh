#!/bin/bash
# CI/CD verification script
# Runs all quality checks without fixing (suitable for CI pipelines)

set -e

echo "🚀 Running full CI verification suite..."
echo ""

# Check formatting
echo "📋 Checking code formatting (Prettier)..."
npm run format:check

echo ""
echo "🔍 Running ESLint..."
npm run lint

echo ""
echo "🔧 Running TypeScript type check..."
npm run typecheck

echo ""
echo "🧹 Checking for unused files, exports and dependencies (knip)..."
npm run knip

echo ""
echo "🗄️  Checking for schema drift (db:generate must produce nothing)..."
npm run db:check

echo ""
echo "✅ Running tests with coverage..."
npm run test:ci

echo ""
echo "🏗️  Building production bundle (catches App Router server/client boundary errors)..."
npm run build

echo ""
echo "🔐 Scanning for secrets (gitleaks, full git history)..."
if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks is required (install: brew install gitleaks or use the gitleaks CI action)" >&2
  exit 1
fi
gitleaks git --redact --no-banner -c .gitleaks.toml

echo ""
echo "🛡️  Privacy guard (fixtures/CSV/.env tracking, Garmin payloads)..."
scripts/guard-privacy.sh

echo ""
echo "📦 Auditing production dependencies (high and above)..."
npm audit --omit=dev --audit-level=high

echo ""
echo "🧬 Running mutation tests (enforced break threshold)..."
npm run mutation

echo ""
echo "✨ All CI checks passed!"
