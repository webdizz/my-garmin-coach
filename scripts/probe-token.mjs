// Probe for Garmin Personal API. Prints status + response shape only, never secrets or health values.
// Raw responses go to git-ignored fixtures/.
import fs from "node:fs";
const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const key = /^GARMIN_CONNECT_API_KEY=(.*)$/m.exec(raw)?.[1]?.trim().replace(/^["']|["']$/g, "");
if (!key) throw new Error("GARMIN_CONNECT_API_KEY missing");
const base = "https://personal.connectapi.garmin.com";
const tr = await fetch(`${base}/personalapitoken-service/personal-api/personal-api-key/token`, {
  method: "POST", headers: { Authorization: `ApiKey ${key}` },
});
const token = (await tr.text()).trim();
console.log("token status", tr.status, "length", token.length, "dots", token.split(".").length - 1);
const shape = (v, d = 0) => v === null ? "null" : Array.isArray(v) ? `[${v.length}]${v.length && d < 2 ? shape(v[0], d + 1) : ""}`
  : typeof v === "object" ? (d < 2 ? "{" + Object.entries(v).map(([k, x]) => `${k}:${shape(x, d + 1)}`).join(",") + "}" : "{…}") : typeof v;
const day = process.argv[2] ?? new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const from = process.argv[3] ?? new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
const eps = {
  sleep: `/sleep-service/sleep/dailySleep?date=${day}`,
  sleepSummaries: `/sleep-service/sleep/dailySleepSummariesByDate?startDate=${from}&endDate=${day}`,
  hrvDay: `/hrv-service/hrv/${day}`,
  hrvRange: `/hrv-service/hrv/daily/${from}/${day}`,
  hr: `/wellness-service/wellness/dailyHeartRate?date=${day}`,
  vo2: `/metrics-service/metrics/maxmet/daily/${from}/${day}`,
  weight: `/weight-service/weight/range/${from}/${day}`,
  zones: `/biometric-service/heartRateZones/v2`,
  activities: `/activitylist-service/activities/search/activities?limit=3`,
  daily: `/usersummary-service/usersummary/daily?calendarDate=${day}`,
  stress: `/usersummary-service/stats/stress/daily/${from}/${day}`,
  battery: `/wellness-service/wellness/bodyBattery/reports/daily?startDate=${from}&endDate=${day}`,
  fitnessAge: `/fitnessage-service/fitnessage/v2/${day}`,
  settings: `/userprofile-service/userprofile/settings`,
};
fs.mkdirSync(new URL("../fixtures/", import.meta.url), { recursive: true });
for (const [name, path] of Object.entries(eps)) {
  const r = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
  const t = await r.text();
  let s = t.slice(0, 80).replace(/\s+/g, " ");
  try { const j = JSON.parse(t); s = shape(j); fs.writeFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), JSON.stringify(j, null, 1)); } catch {}
  const rl = [...r.headers].filter(([k]) => /ratelimit|retry-after|x-rate/i.test(k)).map(([k, v]) => `${k}=${v}`).join(" ");
  console.log(`${name} ${r.status} ${rl}\n  ${s.slice(0, 600)}`);
}
