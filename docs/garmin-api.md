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

## Verified (2026-11-23, GC-2 spike)

Checked against live responses with the owner's key. Probe scripts: `scripts/probe-*.mjs`
(print status and shape only; raw JSON goes to git-ignored `fixtures/`).

### Auth
- Base URL: `https://personal.connectapi.garmin.com` (`.cn` variant exists for China).
- Token: `POST /personalapitoken-service/personal-api/personal-api-key/token` with
  `Authorization: ApiKey <key>`. Response body is the **raw JWT string** (not JSON). TTL 24 h.
- Data calls: `Authorization: Bearer <jwt>`.
- JWT scopes: `CONNECT_READ`, `PERSONAL_API_FITNESS_READ`, `PERSONAL_API_NUTRITION_READ`,
  `PERSONAL_API_USER_READ`, `PERSONAL_API_WELLNESS_READ`.

### Rate limits and history
- Rate limit: 60 sequential calls in a row to one endpoint, all 200. No 429, no `RateLimit`/`Retry-After`
  headers. Limit is undocumented; sync gently (cache in SQLite, daily incremental pull).
- History depth: about **1 year**. HRV returns 204 and sleep returns empty at 360 days, data at 330.
  Activity list returned results for older ranges (not measured further, check before relying on it).
- Range endpoints cap the span: HRV daily and VO2 range work at 90 days and return **400 at 400 days**.
  Chunk backfills (e.g. 90-day windows).

### Endpoints
| Area | Call | Status | Notes |
|---|---|---|---|
| Sleep (day) | `GET /sleep-service/sleep/dailySleep?date=YYYY-MM-DD` | OK | `sleepTimeSeconds`, deep/light/rem/awake seconds, `sleepScores.overall`, `avgHeartRate`, `avgSleepStress`, respiration, `sleepNeed`. Empty fields when no data. No resting HR here. |
| Sleep (range) | `GET /sleep-service/sleep/dailySleepSummariesByDate?startDate&endDate` | OK | Array, same shape as day. |
| HRV (day) | `GET /hrv-service/hrv/{date}` | OK | `hrvSummary{weeklyAvg,lastNightAvg,lastNight5MinHigh,baseline,status}` plus ~83 `hrvReadings`. 204 when no data. |
| HRV (range) | `GET /hrv-service/hrv/daily/{from}/{to}` | OK | `hrvSummaries[]`. Max span under 400 days. |
| Resting HR | `GET /wellness-service/wellness/dailyHeartRate?date=` | OK | `restingHeartRate`, `lastSevenDaysAvgRestingHeartRate`, min/max, 2-min `heartRateValues`. |
| VO2max | `GET /metrics-service/metrics/maxmet/daily/{from}/{to}` | OK | `[{generic:{calendarDate,vo2MaxValue,vo2MaxPreciseValue,sport}, cycling}]`. Not in the published Swagger list; found by probing. Only days with a change. |
| Weight | `GET /weight-service/weight/range/{from}/{to}` | OK | `dailyWeightSummaries[].latestWeight{weight,bmi,...}`. `bodyFat`, `bodyWater`, `muscleMass`, `boneMass` are **null** for `sourceType: MANUAL` entries. Unknown for scale readings. |
| Max HR / zones | `GET /biometric-service/heartRateZones/v2` | OK | `maxHeartRateUsed`, `restingHeartRateUsed`, `lactateThresholdHeartRateUsed`, `zone1Floor`..`zone5Floor`. |
| Activities | `GET /activitylist-service/activities/search/activities?limit&start&startDate&endDate` | OK | Rich summary: `averageHR`, `maxHR`, `aerobicTrainingEffect`, `anaerobicTrainingEffect`, `activityTrainingLoad`, `hrTimeInZone_*`, swim stroke fields. |
| Activity detail | `GET /activity-service/activity/{id}` | OK | `summaryDTO`, `metadataDTO`. |
| Activity FIT | `GET /download-service/files/activity/{id}` | OK | Returns a **zip** (`application/x-zip-compressed`) containing the FIT. |
| Body battery | `GET /wellness-service/wellness/bodyBattery/reports/daily?startDate&endDate` | OK | Daily array with `charged`, `drained`, value series. |
| Stress | `GET /usersummary-service/stats/stress/daily/{from}/{to}` | OK | |
| Daily summary | `GET /usersummary-service/usersummary/daily?calendarDate=` | OK | Steps, calories, active seconds. |
| Steps (range) | `GET /usersummary-service/stats/steps/daily/{from}/{to}` | OK | |
| SpO2 | `GET /wellness-service/wellness/daily/spo2acclimation/{date}` | 200 | Content not inspected. |
| Fitness age | `GET /fitnessage-service/fitnessage/v2/{date}` | OK | `fitnessAge`, `achievableFitnessAge`, components. |
| User settings | `GET /userprofile-service/userprofile/settings` | OK | Locale, units. Contains profile data, do not log. |
| Training status | `/metrics-service/metrics/trainingstatus/daily/{date}` | **404** | Guessed path, not found. |
| Training readiness | `/metrics-service/metrics/trainingreadiness/{date}` | **404** | Guessed path, not found. |
| Race predictions | `/metrics-service/metrics/racepredictions/latest` | **404** | Guessed path. |

## Gaps
- **Training status** (productive/maintaining label, acute load, load balance) and **training readiness**:
  no working endpoint found. Partial substitutes: per-activity `activityTrainingLoad` and training effect
  from the activity list. The Swagger bundle lists no such endpoint, so assume absent.
- **Body composition** beyond weight/BMI: null for manual entries. Needs a Garmin scale reading to confirm.
- History is limited to about 1 year. Start syncing now and keep our own copy.
- Rate limits undocumented.

## Mapping to my existing exports

| Export | Equivalent API area | Result |
|---|---|---|
| `A dormir.csv` (sleep score, stages, resting HR, HRV, stress, body battery) | sleep, HRV, heart rate, stress, body battery | Covered. Resting HR comes from `dailyHeartRate`, not sleep. |
| `Peso.csv` (weight, BMI, body fat, muscle, bone, water) | weight | Weight/BMI covered. Body composition unconfirmed. |
| `activity_*.csv` (pool swim, per-length splits) | activity detail / FIT download | FIT zip works. Per-length splits need FIT parsing. |

## Open questions
- Exact rate limit and behaviour on 429.
- Whether any hidden endpoint exposes training status or readiness.
- Body composition fields for real scale readings.
- Activity history depth beyond 1 year.
- FIT SDK needed to parse swim and activity files.
