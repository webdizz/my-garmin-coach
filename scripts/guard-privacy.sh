#!/usr/bin/env bash
# Privacy guard: keeps personal Garmin data and secrets out of git.
#
#   scripts/guard-privacy.sh            # check the index (tracked files) + their content
#   scripts/guard-privacy.sh --staged   # also check staged additions/changes content
#
# Fails (exit 1) when:
#   - fixtures/, *.csv, .env (not .env.example) or *.db/*.sqlite are tracked
#   - a checked file contains Garmin-shaped payloads (JSON fields with real values,
#     Portuguese Garmin CSV headers)
#
# Fails closed: if git is unavailable the script errors out instead of passing.

set -euo pipefail

MODE="tracked"
if [[ "${1:-}" == "--staged" ]]; then
  MODE="staged"
fi

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "guard-privacy: not inside a git repository" >&2
  exit 2
}
cd "$ROOT"

fail=0
report() {
  echo "guard-privacy: BLOCKED: $1" >&2
  fail=1
}

# 1. Forbidden paths in the index.
FORBIDDEN_PATH='(^|/)fixtures/|\.csv$|(^|/)\.env($|\.)|\.(db|sqlite3?)$'
while IFS= read -r path; do
  [[ -z "$path" ]] && continue
  if [[ "$path" == ".env.example" || "$path" == */.env.example ]]; then
    continue
  fi
  if printf '%s\n' "$path" | grep -Eiq "$FORBIDDEN_PATH"; then
    report "tracked personal/secret path: $path (remove with: git rm --cached \"$path\")"
  fi
done < <(git ls-files)

# 2. Garmin-shaped content.
#    JSON: a Garmin field name whose value is a number or an ISO date (real payload).
#    Schema placeholders like "calendarDate": "string" intentionally do NOT match.
GARMIN_FIELDS='calendarDate|activityId|userProfileId|restingHeartRate|sleepStartTimestampGMT|startTimeGMT|bodyBatteryChargedValue|averageSleepHeartRate|totalSteps|overallStressLevel|lastNightAvg'
PAYLOAD_JSON="\"(${GARMIN_FIELDS})\"[[:space:]]*:[[:space:]]*(-?[0-9]|\"[0-9]{4}-[0-9]{2}-[0-9]{2})"
#    CSV: Portuguese-localised Garmin export headers.
PAYLOAD_CSV='(^|[,;])(Tempo|Peso|Gordura corporal|Massa muscular esquel[eé]tica|Braçada)([,;]|$)'

# Files this guard itself and docs legitimately mention Garmin field names.
CONTENT_EXCLUDE='^scripts/guard-privacy\.sh$|^docs/garmin-api\.md$|^docs/data-exports\.md$'

scan_content() {
  local path="$1" blob="$2"
  if printf '%s' "$path" | grep -Eq "$CONTENT_EXCLUDE"; then
    return 0
  fi
  if printf '%s' "$blob" | grep -Eaq "$PAYLOAD_JSON"; then
    report "Garmin-shaped JSON payload (real values) in: $path"
  fi
  if printf '%s' "$blob" | grep -Eaq "$PAYLOAD_CSV"; then
    report "Garmin CSV export header in: $path"
  fi
}

if [[ "$MODE" == "staged" ]]; then
  # Content of what is about to be committed (index), added or modified files only.
  while IFS= read -r -d '' path; do
    scan_content "$path" "$(git show ":$path" 2>/dev/null || true)"
  done < <(git diff --cached --name-only --diff-filter=ACMR -z)
  # Newly staged forbidden paths are also caught by the index loop above
  # because `git ls-files` lists staged additions.
else
  while IFS= read -r -d '' path; do
    [[ -f "$path" ]] || continue
    scan_content "$path" "$(cat "$path")"
  done < <(git ls-files -z)
fi

if [[ "$fail" -ne 0 ]]; then
  echo "guard-privacy: failed. Health data and secrets must not enter git." >&2
  echo "See HOOKS_GUIDE.md (Privacy guard)." >&2
  exit 1
fi

echo "guard-privacy: ok ($MODE)"
