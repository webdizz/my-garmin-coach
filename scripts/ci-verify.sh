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
echo "✅ Running tests with coverage..."
npm run test:ci

echo ""
echo "🧬 Running mutation tests (enforced break threshold)..."
npm run mutation

echo ""
echo "✨ All CI checks passed!"
