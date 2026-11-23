import fs from "node:fs";
const raw = fs.readFileSync(new URL("../.env", import.meta.url), "utf8");
const key = /^GARMIN_CONNECT_API_KEY=(.*)$/m.exec(raw)?.[1]?.trim().replace(/^["']|["']$/g, "");
const base = "https://personal.connectapi.garmin.com";
const token = (await (await fetch(`${base}/personalapitoken-service/personal-api/personal-api-key/token`, { method: "POST", headers: { Authorization: `ApiKey ${key}` } })).text()).trim();
const H = { Authorization: `Bearer ${token}` };
const iso = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const get = async p => { const r = await fetch(base + p, { headers: H }); const t = await r.text(); let j; try { j = JSON.parse(t); } catch {} return { r, t, j }; };
// history depth
for (const d of [30, 90, 180, 365, 730, 1500]) {
  const hrv = await get(`/hrv-service/hrv/${iso(d)}`);
  const sl = await get(`/sleep-service/sleep/dailySleep?date=${iso(d)}`);
  const w = await get(`/weight-service/weight/range/${iso(d + 7)}/${iso(d)}`);
  const act = await get(`/activitylist-service/activities/search/activities?limit=1&start=0&startDate=${iso(d + 30)}&endDate=${iso(d)}`);
  console.log(d, "hrv", hrv.r.status, hrv.j?.hrvSummary ? "data" : "none", "| sleep", sl.r.status, sl.j?.sleepTimeSeconds ? "data" : "none", "| weight", w.r.status, w.j?.dailyWeightSummaries?.length ?? "-", "| act", act.r.status, Array.isArray(act.j) ? act.j.length : act.t.slice(0, 60));
}
// range limits
for (const n of [30, 90, 400]) { const x = await get(`/hrv-service/hrv/daily/${iso(n)}/${iso(0)}`); console.log("hrv range", n, x.r.status, x.j?.hrvSummaries?.length ?? x.t.slice(0, 100)); }
for (const n of [30, 400]) { const x = await get(`/metrics-service/metrics/maxmet/daily/${iso(n)}/${iso(0)}`); console.log("vo2 range", n, x.r.status, Array.isArray(x.j) ? x.j.length : x.t.slice(0, 100)); }
// body comp keys in weight
const w = JSON.parse(fs.readFileSync(new URL("../fixtures/weight.json", import.meta.url)));
console.log("weight day keys", Object.keys(w.dailyWeightSummaries[0]), "latest keys", Object.keys(w.dailyWeightSummaries[0].latestWeight ?? {}));
console.log("weight nonnull", Object.entries(w.dailyWeightSummaries[0].latestWeight ?? {}).filter(([, v]) => v !== null).map(([k]) => k).join(","));
// vo2 / sleep keys
const v = JSON.parse(fs.readFileSync(new URL("../fixtures/vo2.json", import.meta.url)));
console.log("vo2 generic keys", Object.keys(v[0].generic ?? {}));
const s = JSON.parse(fs.readFileSync(new URL("../fixtures/sleep.json", import.meta.url)));
console.log("sleep top", Object.keys(s).join(","));
const z = JSON.parse(fs.readFileSync(new URL("../fixtures/zones.json", import.meta.url)));
console.log("zones sports", z.map(x => x.sport).join(","));
// activity detail + FIT + training status guesses
const a = JSON.parse(fs.readFileSync(new URL("../fixtures/activities.json", import.meta.url)));
const id = a[0].activityId;
console.log("activity type", a[0].activityType?.typeKey, "keys with vo2/te:", Object.keys(a[0]).filter(k => /vo2|train|aerobic|anaerobic|load|recover/i.test(k)).join(","));
const det = await get(`/activity-service/activity/${id}`); console.log("detail", det.r.status, det.j ? Object.keys(det.j).join(",") : det.t.slice(0, 80));
const fit = await fetch(`${base}/download-service/files/activity/${id}`, { headers: H }); const buf = Buffer.from(await fit.arrayBuffer()); console.log("fit", fit.status, fit.headers.get("content-type"), buf.length, buf.slice(8, 12).toString());
for (const p of ["/metrics-service/metrics/trainingstatus/daily/" + iso(1), "/metrics-service/metrics/trainingreadiness/" + iso(1), "/metrics-service/metrics/trainingstatus/aggregated/" + iso(1), "/metrics-service/metrics/racepredictions/latest", "/metrics-service/metrics/endurancescore?calendarDate=" + iso(1), "/wellness-service/wellness/dailySleepData", "/usersummary-service/stats/steps/daily/" + iso(7) + "/" + iso(0), "/wellness-service/wellness/daily/spo2acclimation/" + iso(1)]) { const x = await get(p); console.log("guess", p.split("?")[0].slice(0, 70), x.r.status); }
// rate limit burst
const codes = {}; let first429 = null;
for (let i = 0; i < 60; i++) { const x = await get(`/wellness-service/wellness/dailyHeartRate?date=${iso(1)}`); codes[x.r.status] = (codes[x.r.status] ?? 0) + 1; if (x.r.status === 429 && !first429) first429 = i; }
console.log("burst60", codes, "first429", first429);
