import fs from "node:fs";
const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const key = /^GARMIN_CONNECT_API_KEY=(.*)$/m.exec(raw)?.[1]?.trim().replace(/^["']|["']$/g, "");
const base = "https://personal.connectapi.garmin.com";
const token = (await (await fetch(`${base}/personalapitoken-service/personal-api/personal-api-key/token`, { method: "POST", headers: { Authorization: `ApiKey ${key}` } })).text()).trim();
const H = { Authorization: `Bearer ${token}` };
const iso = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
for (const d of [200, 250, 300, 330, 360]) {
  const h = await fetch(`${base}/hrv-service/hrv/${iso(d)}`, { headers: H });
  const s = await (await fetch(`${base}/sleep-service/sleep/dailySleep?date=${iso(d)}`, { headers: H })).json();
  const a = await (await fetch(`${base}/activitylist-service/activities/search/activities?limit=1&startDate=${iso(d + 30)}&endDate=${iso(d)}`, { headers: H })).json();
  console.log(d, "hrv", h.status, "sleep", s.sleepTimeSeconds ? "data" : "none", "act", a.length);
}
const x = await (await fetch(`${base}/activitylist-service/activities/search/activities?limit=1&startDate=2020-01-01&endDate=${iso(300)}`, { headers: H })).json();
console.log("old acts", x.length);
const w = JSON.parse(fs.readFileSync(new URL("../fixtures/weight.json", import.meta.url)));
console.log("sourceTypes", [...new Set(w.dailyWeightSummaries.map(d => d.latestWeight.sourceType))].join(","));
const z = JSON.parse(fs.readFileSync(new URL("../fixtures/zones.json", import.meta.url)))[0];
console.log("zones nonnull", Object.entries(z).filter(([, v]) => v != null).map(([k]) => k).join(","));
const r = await fetch(`${base}/wellness-service/wellness/dailyHeartRate?date=${iso(1)}`, { headers: H });
console.log("rl headers", [...r.headers.keys()].filter(k => /limit|retry/i.test(k)).join(",") || "none");
