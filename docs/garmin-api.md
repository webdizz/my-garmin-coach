# Garmin Personal API

Source pages:
- Overview: https://developer.garmin.com/gc-developer-program/overview/
- Personal FAQ: https://developer.garmin.com/gc-developer-program/personal/personal-faq/
- Swagger docs: https://developer.garmin.com/gc-developer-program/personal/swagger-docs/

## What it is

- Official Garmin Connect Developer Program, **Personal** tier. Intended for an individual to access
  **their own** Garmin Connect data.
- Get a personal API key at https://connect.garmin.com/app/settings/personalApiToken.
  The key is shown **once**. If lost, delete and regenerate.
- Auth: API key, exchanged for OAuth2 access tokens via the token endpoint.
- Can revoke/delete the key at any time. Deletion invalidates associated tokens.
- Delivery: **pull only** (no webhooks for Personal).
- Data listed as included: activity data (JSON and FIT), health data (JSON), women's health data (JSON).
- Starter/Enterprise access is a separate application for multi-user apps. Not needed here.

## Endpoints (unverified)

Paths taken from the Swagger page's JS bundle. Base URL, auth header format, parameters, response
schemas and rate limits are **not yet verified**.

| Area | Path |
|---|---|
| Sleep (daily) | `/sleep-service/sleep/dailySleep` |
| Sleep summaries | `/sleep-service/sleep/dailySleepSummariesByDate` |
| HRV (daily range) | `/hrv-service/hrv/daily/{fromDate}/{toDate}` |
| HRV (single day) | `/hrv-service/hrv/{calendarDate}` |
| Resting / daily heart rate | `/wellness-service/wellness/dailyHeartRate` |
| Body battery | `/wellness-service/wellness/bodyBattery/reports/daily` |
| Stress (daily range) | `/usersummary-service/stats/stress/daily/{startDate}/{endDate}` |
| SpO2 acclimation | `/wellness-service/wellness/daily/spo2acclimation/{calendarDate}` |
| Weight (range) | `/weight-service/weight/range/{startDate}/{endDate}` |
| Weight (all) | `/weight-service/weight/all/{startDate}/{endDate}` |
| Weight goal | `/goal-service/goal/user/effective/weightgoal/{startDate}/{endDate}` |
| Fitness age | `/fitnessage-service/fitnessage/v2/{calendarDate}` |
| Activity list / search | `/activitylist-service/activities/search/activities` |
| Activity summary (range) | `/wellnessactivity-service/activity/summary/range/{fromDate}/{untilDate}` |
| Activity detail | `/activity-service/activity/{activityId}` |
| Workouts in activity | `/activity-service/activity/{activityId}/workouts` |
| Activity file (FIT) | `/download-service/files/activity/{activityId}` |
| Menstrual cycle (day / summary) | `/periodichealth-service/menstrualcycle/dayview/{calendarDate}`, `/periodichealth-service/menstrualcycle/summary/{calendarDate}` |

## Mapping to my existing exports

| Export | Equivalent API area | Confidence |
|---|---|---|
| `A dormir.csv` (sleep score, stages, resting HR, HRV, stress, body battery) | sleep, HRV, heart rate, stress, body battery | Likely covered; verify fields |
| `Peso.csv` (weight, BMI, body fat, muscle, bone, water) | weight | Weight/BMI likely; body composition fields **unconfirmed** |
| `activity_*.csv` (pool swim, per-length splits) | activity detail / FIT download | Covered via FIT file; need to parse FIT for lengths |

## Open questions

- Exact base URL and auth header format.
- Response schemas for each endpoint (field names, units, nullability).
- History depth available per endpoint.
- Rate limits and recommended sync cadence.
- Whether body composition values (body fat, muscle, water) are returned for scale-only readings.
- Whether Garmin's CSV-only metrics (e.g. "Momentos inquietos", "Battery" end-of-day value) exist in the API.
- FIT SDK needed for parsing swim/activity files (not yet chosen).

## Verification plan

1. Create key, store in `.env` as a named variable (never print it).
2. Make one call per area with a short date range; save the raw JSON to a git-ignored `fixtures/` dir.
3. Diff raw fields against the matching CSV row for the same day.
4. Record base URL, auth flow and rate-limit headers here.
