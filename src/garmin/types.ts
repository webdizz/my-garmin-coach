/**
 * Typed subset of Garmin Connect Personal API responses (see docs/garmin-api.md, verified GC-2).
 * Only fields the app uses are typed. Units: weight is in GRAMS, durations in seconds.
 */

/** `GET /hrv-service/hrv/{date}` and each element of `/hrv-service/hrv/daily/{from}/{to}`. */
interface HrvBaseline {
  lowUpper: number;
  balancedLow: number;
  balancedUpper: number;
  markerValue: number;
}

interface HrvSummary {
  calendarDate: string;
  weeklyAvg: number;
  lastNightAvg: number;
  lastNight5MinHigh: number;
  baseline: HrvBaseline;
  status: string;
  feedbackPhrase: string;
  createTimeStamp: string;
}

export interface HrvDay {
  hrvSummary: HrvSummary;
  hrvReadings: { hrvValue: number; readingTimeGMT: string; readingTimeLocal: string }[];
}

export interface HrvRange {
  hrvSummaries: HrvSummary[];
}

/** `GET /sleep-service/sleep/dailySleepSummariesByDate` (array element). */
export interface SleepSummary {
  calendarDate: string;
  sleepTimeSeconds: number;
  napTimeSeconds: number;
  deepSleepSeconds: number;
  lightSleepSeconds: number;
  remSleepSeconds: number;
  awakeSleepSeconds: number;
  unmeasurableSleepSeconds: number;
  averageRespirationValue: number;
  avgSleepStress: number;
  avgHeartRate: number;
  sleepScores: {
    overall: { value: number; qualifierKey: string };
  };
}

/** `GET /wellness-service/wellness/dailyHeartRate?date=` */
export interface DailyHeartRate {
  calendarDate: string;
  maxHeartRate: number;
  minHeartRate: number;
  restingHeartRate: number;
  lastSevenDaysAvgRestingHeartRate: number;
}

/** `GET /biometric-service/heartRateZones/v2` (array element). */
export interface HeartRateZones {
  sport: string;
  maxHeartRateUsed: number;
  restingHeartRateUsed: number;
  lactateThresholdHeartRateUsed: number;
  zone1Floor: number;
  zone2Floor: number;
  zone3Floor: number;
  zone4Floor: number;
  zone5Floor: number;
}

/** `GET /weight-service/weight/range/{from}/{to}` */
export interface WeightRange {
  dailyWeightSummaries: {
    summaryDate: string;
    latestWeight: {
      calendarDate: string;
      /** Grams. Divide by 1000 for kg. */
      weight: number;
      bmi: number | null;
      bodyFat: number | null;
      bodyWater: number | null;
      boneMass: number | null;
      muscleMass: number | null;
      sourceType: string;
    };
  }[];
}

/** `GET /wellness-service/wellness/bodyBattery/reports/daily?startDate&endDate` (array element). */
export interface BodyBatteryDay {
  date: string;
  charged: number;
  drained: number;
}

/** `GET /usersummary-service/stats/stress/daily/{from}/{to}` (array element). */
export interface StressDay {
  calendarDate: string;
  values: {
    overallStressLevel: number;
    restStressDuration: number;
    lowStressDuration: number;
    mediumStressDuration: number;
    highStressDuration: number;
  };
}

/** `GET /usersummary-service/usersummary/daily?calendarDate=` */
export interface DailySummary {
  calendarDate: string;
  totalSteps: number;
  totalKilocalories: number;
  activeKilocalories: number;
  dailyStepGoal: number;
}

/** `GET /fitnessage-service/fitnessage/v2/{date}` */
export interface FitnessAge {
  chronologicalAge: number;
  fitnessAge: number;
  achievableFitnessAge: number;
  previousFitnessAge: number;
  lastUpdated: string;
}

/** `GET /metrics-service/metrics/maxmet/daily/{from}/{to}` (array element; only days with a change). */
export interface Vo2MaxDay {
  generic: {
    calendarDate: string;
    vo2MaxValue: number | null;
    vo2MaxPreciseValue: number | null;
    sport: string;
  };
}

/** `GET /activitylist-service/activities/search/activities` (array element; subset). */
export interface ActivitySummary {
  activityId: number;
  activityName: string;
  startTimeLocal: string;
  startTimeGMT: string;
  activityType: { typeId: number; typeKey: string; parentTypeId: number };
  distance: number;
  duration: number;
  averageHR: number;
  maxHR: number;
  calories: number;
  activityTrainingLoad: number;
  aerobicTrainingEffect: number;
  anaerobicTrainingEffect: number;
}
