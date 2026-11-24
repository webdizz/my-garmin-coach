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

| Area               | Call                                                                                   | Status  | Notes                                                                                                                                                                               |
| ------------------ | -------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sleep (day)        | `GET /sleep-service/sleep/dailySleep?date=YYYY-MM-DD`                                  | OK      | `sleepTimeSeconds`, deep/light/rem/awake seconds, `sleepScores.overall`, `avgHeartRate`, `avgSleepStress`, respiration, `sleepNeed`. Empty fields when no data. No resting HR here. |
| Sleep (range)      | `GET /sleep-service/sleep/dailySleepSummariesByDate?startDate&endDate`                 | OK      | Array, same shape as day.                                                                                                                                                           |
| HRV (day)          | `GET /hrv-service/hrv/{date}`                                                          | OK      | `hrvSummary{weeklyAvg,lastNightAvg,lastNight5MinHigh,baseline,status}` plus ~83 `hrvReadings`. 204 when no data.                                                                    |
| HRV (range)        | `GET /hrv-service/hrv/daily/{from}/{to}`                                               | OK      | `hrvSummaries[]`. Max span under 400 days.                                                                                                                                          |
| Resting HR         | `GET /wellness-service/wellness/dailyHeartRate?date=`                                  | OK      | `restingHeartRate`, `lastSevenDaysAvgRestingHeartRate`, min/max, 2-min `heartRateValues`.                                                                                           |
| VO2max             | `GET /metrics-service/metrics/maxmet/daily/{from}/{to}`                                | OK      | `[{generic:{calendarDate,vo2MaxValue,vo2MaxPreciseValue,sport}, cycling}]`. Not in the published Swagger list; found by probing. Only days with a change.                           |
| Weight             | `GET /weight-service/weight/range/{from}/{to}`                                         | OK      | `dailyWeightSummaries[].latestWeight{weight,bmi,...}`. `bodyFat`, `bodyWater`, `muscleMass`, `boneMass` are **null** for `sourceType: MANUAL` entries. Unknown for scale readings.  |
| Max HR / zones     | `GET /biometric-service/heartRateZones/v2`                                             | OK      | `maxHeartRateUsed`, `restingHeartRateUsed`, `lactateThresholdHeartRateUsed`, `zone1Floor`..`zone5Floor`.                                                                            |
| Activities         | `GET /activitylist-service/activities/search/activities?limit&start&startDate&endDate` | OK      | Rich summary: `averageHR`, `maxHR`, `aerobicTrainingEffect`, `anaerobicTrainingEffect`, `activityTrainingLoad`, `hrTimeInZone_*`, swim stroke fields.                               |
| Activity detail    | `GET /activity-service/activity/{id}`                                                  | OK      | `summaryDTO`, `metadataDTO`.                                                                                                                                                        |
| Activity FIT       | `GET /download-service/files/activity/{id}`                                            | OK      | Returns a **zip** (`application/x-zip-compressed`) containing the FIT.                                                                                                              |
| Body battery       | `GET /wellness-service/wellness/bodyBattery/reports/daily?startDate&endDate`           | OK      | Daily array with `charged`, `drained`, value series.                                                                                                                                |
| Stress             | `GET /usersummary-service/stats/stress/daily/{from}/{to}`                              | OK      |                                                                                                                                                                                     |
| Daily summary      | `GET /usersummary-service/usersummary/daily?calendarDate=`                             | OK      | Steps, calories, active seconds.                                                                                                                                                    |
| Steps (range)      | `GET /usersummary-service/stats/steps/daily/{from}/{to}`                               | OK      |                                                                                                                                                                                     |
| SpO2               | `GET /wellness-service/wellness/daily/spo2acclimation/{date}`                          | 200     | Shape in [Response shapes](#response-shapes-verified-2026-11-24). Summary fields `null` on probed days.                                                                             |
| Fitness age        | `GET /fitnessage-service/fitnessage/v2/{date}`                                         | OK      | `fitnessAge`, `achievableFitnessAge`, components.                                                                                                                                   |
| User settings      | `GET /userprofile-service/userprofile/settings`                                        | OK      | Locale, units. Contains profile data, do not log.                                                                                                                                   |
| Training status    | `/metrics-service/metrics/trainingstatus/daily/{date}`                                 | **404** | Guessed path, not found.                                                                                                                                                            |
| Training readiness | `/metrics-service/metrics/trainingreadiness/{date}`                                    | **404** | Guessed path, not found.                                                                                                                                                            |
| Race predictions   | `/metrics-service/metrics/racepredictions/latest`                                      | **404** | Guessed path.                                                                                                                                                                       |

## Response shapes (verified 2026-11-24)

Field names and JSON types only, generated from live 200 responses with the owner's key. Values are
not recorded: responses contain health data. `null` means the field was null on the probed day and may
hold another type on other days. `[x]` means an array of `x`. Lists are abridged where noted.

Re-verify with a fresh probe before coding against a field; the API may change.

### Sleep

`GET /sleep-service/sleep/dailySleep?date=YYYY-MM-DD` (object). Range endpoint
`GET /sleep-service/sleep/dailySleepSummariesByDate?startDate&endDate` returns `[same object]`.

```jsonc
{
  "id": "number",
  "userProfilePK": "number",
  "calendarDate": "string",
  "sleepTimeSeconds": "number",
  "napTimeSeconds": "number",
  "sleepWindowConfirmed": "boolean",
  "sleepWindowConfirmationType": "string",
  "sleepStartTimestampGMT": "number",
  "sleepEndTimestampGMT": "number",
  "sleepStartTimestampLocal": "number",
  "sleepEndTimestampLocal": "number",
  "autoSleepStartTimestampGMT": "null",
  "autoSleepEndTimestampGMT": "null",
  "sleepQualityTypePK": "null",
  "sleepResultTypePK": "null",
  "unmeasurableSleepSeconds": "number",
  "deepSleepSeconds": "number",
  "lightSleepSeconds": "number",
  "remSleepSeconds": "number",
  "awakeSleepSeconds": "number",
  "deviceRemCapable": "boolean",
  "retro": "boolean",
  "sleepFromDevice": "boolean",
  "averageRespirationValue": "number",
  "lowestRespirationValue": "number",
  "highestRespirationValue": "number",
  "awakeCount": "number",
  "avgSleepStress": "number",
  "ageGroup": "string",
  "avgHeartRate": "number",
  "sleepScoreFeedback": "string",
  "sleepScoreInsight": "string",
  "sleepScorePersonalizedInsight": "string",
  "sleepScores": {
    "overall": {
      "value": "number",
      "qualifierKey": "string",
    } /* plus per-component score objects, abridged */,
  },
  "sleepVersion": "number",
  "nextSleepNeed": {
    "userProfilePk": "number",
    "calendarDate": "string",
    "deviceId": "number",
    "timestampGmt": "string",
    "baseline": "number",
    "actual": "number",
    "feedback": "string",
    "trainingFeedback": "string",
    "sleepHistoryAdjustment": "string",
    "hrvAdjustment": "string",
    "napAdjustment": "string",
    "displayedForTheDay": "boolean",
    "recommendedBedtimeStartMins": "number",
    "recommendedBedtimeEndMins": "number",
    "preferredActivityTracker": "boolean",
  },
  "sleepAlignment": {
    "userId": "number",
    "calendarDate": "string",
    "deviceId": "number",
    "isPreferredActivityTracker": "boolean",
    "sleepNeedBaselineMins": "number",
    "optimalSleepWindowStartMins": "number",
    "optimalSleepWindowEndMins": "number",
    "status": "string",
    "optimalSleepWindowMidpointMins": "number",
    "lastSleepMidpointMins": "number",
  },
}
```

### HRV

`GET /hrv-service/hrv/{date}` (object, abridged):

```jsonc
{
  "userProfilePk": "number",
  "hrvSummary": {
    "calendarDate": "string",
    "weeklyAvg": "number",
    "lastNightAvg": "number",
    "lastNight5MinHigh": "number",
    "baseline": {
      "lowUpper": "number",
      "balancedLow": "number",
      "balancedUpper": "number",
      "markerValue": "number",
    },
    "status": "string",
    "feedbackPhrase": "string",
    "createTimeStamp": "string",
  },
  "hrvReadings": [
    { "hrvValue": "number", "readingTimeGMT": "string", "readingTimeLocal": "string" },
  ],
  "startTimestampGMT": "string",
  "endTimestampGMT": "string",
  "startTimestampLocal": "string",
  "endTimestampLocal": "string",
  "sleepStartTimestampGMT": "string",
  "sleepEndTimestampGMT": "string",
  "sleepStartTimestampLocal": "string",
  "sleepEndTimestampLocal": "string",
}
```

`GET /hrv-service/hrv/daily/{from}/{to}` returns `{ "hrvSummaries": [hrvSummary], "userProfilePk": "number" }`.

### Heart rate and zones

`GET /wellness-service/wellness/dailyHeartRate?date=` (object):

```jsonc
{
  "userProfilePK": "number",
  "calendarDate": "string",
  "startTimestampGMT": "string",
  "endTimestampGMT": "string",
  "startTimestampLocal": "string",
  "endTimestampLocal": "string",
  "maxHeartRate": "number",
  "minHeartRate": "number",
  "restingHeartRate": "number",
  "lastSevenDaysAvgRestingHeartRate": "number",
  "heartRateValues": [["number", "number"]],
  "heartRateValueDescriptors": [{ "index": "number", "key": "string" }],
}
```

`GET /biometric-service/heartRateZones/v2` returns `[{ "trainingMethod": "string", "restingHeartRateUsed": "number", "lactateThresholdHeartRateUsed": "number", "zone1Floor": "number", "zone2Floor": "number", "zone3Floor": "number", "zone4Floor": "number", "zone5Floor": "number", "maxHeartRateUsed": "number", "restingHrAutoUpdateUsed": "boolean", "sport": "string" }]`.

### Body battery, stress, steps

`GET /wellness-service/wellness/bodyBattery/reports/daily?startDate&endDate` returns `[{ "date": "string", "charged": "number", "drained": "number", "startTimestampGMT": "string", "endTimestampGMT": "string", "startTimestampLocal": "string", "endTimestampLocal": "string", "bodyBatteryDynamicFeedbackEvent": {"eventTimestampGmt": "string", "bodyBatteryLevel": "string", "feedbackShortType": "string", "feedbackLongType": "string"}, "bodyBatteryActivityEvent": [{"eventType": "string", "eventStartTimeGmt": "string", "timezoneOffset": "number", "durationInMilliseconds": "number", "bodyBatteryImpact": "number", "feedbackType": "string", "shortFeedback": "string"}], "endOfDayBodyBatteryDynamicFeedbackEvent": {} }]`. (Per-timestamp series are omitted here.)

`GET /usersummary-service/stats/stress/daily/{from}/{to}` returns `[{ "calendarDate": "string", "values": { "overallStressLevel": "number", "restStressDuration": "number", "lowStressDuration": "number", "mediumStressDuration": "number", "highStressDuration": "number" } }]`.

`GET /usersummary-service/stats/steps/daily/{from}/{to}` returns `[{ "calendarDate": "string", "totalSteps": "number", "totalDistance": "number", "stepGoal": "number" }]`.

### Daily summary

`GET /usersummary-service/usersummary/daily?calendarDate=` (object, ~100 fields). Key fields: `userProfileId`, `calendarDate`, `totalKilocalories`, `activeKilocalories`, `bmrKilocalories`, `totalSteps`, `dailyStepGoal`, `totalDistanceMeters`, `highlyActiveSeconds`, `activeSeconds`, `sedentarySeconds`, `sleepingSeconds`, `moderateIntensityMinutes`, `vigorousIntensityMinutes`, `floorsAscended`, `floorsDescended`, `minHeartRate`, `maxHeartRate`, `restingHeartRate`, `lastSevenDaysAvgRestingHeartRate`, `averageStressLevel`, `maxStressLevel`, `stressPercentage`, `bodyBatteryChargedValue`, `bodyBatteryDrainedValue`, `bodyBatteryHighestValue`, `bodyBatteryLowestValue`, `bodyBatteryMostRecentValue`, `bodyBatteryDuringSleep`, `bodyBatteryAtWakeTime`, `averageSpo2`, `lowestSpo2`, `latestSpo2` (`null` on probed day), `avgWakingRespirationValue`, `wellnessStartTimeGmt`, `wellnessEndTimeGmt`, `source` (`string`).

### SpO2

`GET /wellness-service/wellness/daily/spo2acclimation/{date}` (object):

```jsonc
{
  "userProfilePK": "number",
  "calendarDate": "string",
  "startTimestampGMT": "string",
  "endTimestampGMT": "string",
  "startTimestampLocal": "string",
  "endTimestampLocal": "string",
  "sleepStartTimestampGMT": "string",
  "sleepEndTimestampGMT": "string",
  "sleepStartTimestampLocal": "string",
  "sleepEndTimestampLocal": "string",
  "tomorrowSleepStartTimestampGMT": "null",
  "tomorrowSleepEndTimestampGMT": "null",
  "tomorrowSleepStartTimestampLocal": "null",
  "tomorrowSleepEndTimestampLocal": "null",
  "averageSpO2": "null",
  "lowestSpO2": "null",
  "lastSevenDaysAvgSpO2": "null",
  "latestSpO2": "null",
  "latestSpO2TimestampGMT": "null",
  "latestSpO2TimestampLocal": "null",
  "avgSleepSpO2": "null",
  "avgTomorrowSleepSpO2": "null",
  "spO2SingleValuesDescriptorList": "null",
  "spO2SingleValues": "null",
  "spO2HourlyAveragesDescriptorList": [
    { "spo2ValueDescIndex": "number", "spo2ValueDescKey": "string" },
  ],
  "spO2HourlyAverages": [["number"]],
  "monitoringEnvironmentValuesDescriptorList": [
    { "monEnvValueDescIndex": "number", "monEnvValueDescKey": "string" },
  ],
  "monitoringEnvironmentValues": [["number"]],
}
```

### Fitness age

`GET /fitnessage-service/fitnessage/v2/{date}` (object):

```jsonc
{
  "chronologicalAge": "number",
  "fitnessAge": "number",
  "achievableFitnessAge": "number",
  "previousFitnessAge": "number",
  "lastUpdated": "string",
  "components": {
    "vigorousDaysAvg": { "value": "number", "stale": "boolean", "numOfWeeksForIm": "number" },
    "rhr": { "value": "number", "stale": "boolean" },
    "vigorousMinutesAvg": { "value": "number", "stale": "boolean", "numOfWeeksForIm": "number" },
    "bmi": {
      "value": "number",
      "targetValue": "number",
      "improvementValue": "number",
      "potentialAge": "number",
      "priority": "number",
      "stale": "boolean",
      "lastMeasurementDate": "string",
    },
  },
}
```

The `components` keys and their sub-fields vary by day. Treat every component key as optional.

### VO2 max

`GET /metrics-service/metrics/maxmet/daily/{from}/{to}` returns `[{ "generic": { "calendarDate": "string", "vo2MaxPreciseValue": "number", "vo2MaxValue": "number", "sport": "string", "subSport": "string" }, "cycling": "null" }]`.

### Weight

`GET /weight-service/weight/range/{from}/{to}` returns `{ "dailyWeightSummaries": [{ "summaryDate": "string", "numOfWeightEntries": "number", "minWeight": "number", "maxWeight": "number", "latestWeight": { "samplePk": "number", "date": "number", "calendarDate": "string", "weight": "number", "bmi": "number", "bodyFat": "null", "bodyWater": "null", "boneMass": "null", "muscleMass": "null", "physiqueRating": "null", "visceralFat": "null", "metabolicAge": "null", "sourceType": "string", "timestampGMT": "number", "weightDelta": "number" }, "allWeightMetrics": [] }], "totalAverage": {}, "previousDateWeight": {}, "nextDateWeight": "null" }`. Weight is in grams.

### Activities

`GET /activitylist-service/activities/search/activities?limit&start&startDate&endDate` returns `[activity]`. Abridged. Key fields: `activityId`, `activityName`, `startTimeLocal`, `startTimeGMT`, `activityType { typeId, typeKey, parentTypeId }`, `distance`, `duration`, `elapsedDuration`, `movingDuration`, `elevationGain`, `averageSpeed`, `maxSpeed`, `calories`, `averageHR`, `maxHR`, `steps`, `aerobicTrainingEffect`, `anaerobicTrainingEffect`, `activityTrainingLoad`, `trainingEffectLabel`, `moderateIntensityMinutes`, `vigorousIntensityMinutes`, `avgPower`, `maxPower`, `normPower`, `avgGroundContactTime`, `avgStrideLength`, `avgVerticalOscillation`, `avgVerticalRatio`, `lapCount`, `differenceBodyBattery`, `hrTimeInZone_1..5`, `powerTimeInZone_1..5`, `fastestSplit_1000`, `fastestSplit_1609`, `fastestSplit_5000`, `activityUUID`, `manufacturer`, `locationName`, `isManualActivity`, `hasImages`, `hasVideo`.

`GET /activity-service/activity/{activityId}` returns `{ "activityId": "number", "activityUUID": { "uuid": "string" }, "activityName": "string", "activityTypeDTO": { "typeId": "number", "typeKey": "string", "parentTypeId": "number" }, "eventTypeDTO": {}, "accessControlRuleDTO": {}, "timeZoneUnitDTO": { "timeZone": "string" }, "metadataDTO": { "isOriginal": "boolean", "fileFormat": { "formatId": "number", "formatKey": "string" }, "lastUpdateDate": "string", "uploadedDate": "string", "manufacturer": "string", "lapCount": "number", "hasRunPowerWindData": "boolean", "personalRecord": "boolean", "...": "booleans" }, "summaryDTO": { "startTimeLocal": "string", "startTimeGMT": "string", "distance": "number", "duration": "number", "movingDuration": "number", "elapsedDuration": "number", "averageSpeed": "number", "maxSpeed": "number", "calories": "number", "averageHR": "number", "maxHR": "number", "minHR": "number", "trainingEffect": "number", "anaerobicTrainingEffect": "number", "activityTrainingLoad": "number", "steps": "number", "waterEstimated": "number", "...": "~50 more numeric and string fields" }, "splitSummaries": [{ "distance": "number", "duration": "number", "averageSpeed": "number", "averageHR": "number", "splitType": "string", "noOfSplits": "number", "...": "more" }] }`.

`GET /download-service/files/activity/{activityId}` returns a ZIP archive (`application/x-zip-compressed`, magic `PK`) that contains the FIT file. A `.zip` extraction step is needed before FIT parsing.

### User settings

`GET /userprofile-service/userprofile/settings` returns `{ "displayName": "string", "preferredLocale": "string", "measurementSystem": "string", "numberFormat": "string", "timeZone": "string", "hydrationMeasurementUnit": "string", "hydrationContainers": [], "golfDistanceUnit": "string", "firstDayOfWeek": { "dayId": "number", "dayName": "string", "sortOrder": "number", "isPossibleFirstDay": "boolean" }, "timeFormat": {} }`, plus further `*Format` objects. Contains profile data. Do not log.

## Gaps

- **Training status** (productive/maintaining label, acute load, load balance) and **training readiness**:
  no working endpoint found. Partial substitutes: per-activity `activityTrainingLoad` and training effect
  from the activity list. The Swagger bundle lists no such endpoint, so assume absent.
- **Body composition** beyond weight/BMI: null for manual entries. Needs a Garmin scale reading to confirm.
- History is limited to about 1 year. Start syncing now and keep our own copy.
- Rate limits undocumented.

## Mapping to my existing exports

| Export                                                                      | Equivalent API area                          | Result                                                      |
| --------------------------------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------- |
| `A dormir.csv` (sleep score, stages, resting HR, HRV, stress, body battery) | sleep, HRV, heart rate, stress, body battery | Covered. Resting HR comes from `dailyHeartRate`, not sleep. |
| `Peso.csv` (weight, BMI, body fat, muscle, bone, water)                     | weight                                       | Weight/BMI covered. Body composition unconfirmed.           |
| `activity_*.csv` (pool swim, per-length splits)                             | activity detail / FIT download               | FIT zip works. Per-length splits need FIT parsing.          |

## Open questions

- Exact rate limit and behaviour on 429.
- Whether any hidden endpoint exposes training status or readiness.
- Body composition fields for real scale readings.
- Activity history depth beyond 1 year.
- FIT SDK needed to parse swim and activity files.
