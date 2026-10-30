// Which feature queued a job and why (hlstats_gamewe_jobs origin and
// origin_detail, collector schema version 22), as the admin pages Jobs and
// Reset show it. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { originText, parseJobOrigin, webOriginDetail } from "../src/lib/job-origin.ts";
import { scheduleValue } from "../src/lib/hall-period.ts";

const sched = (s: { every: number; unit: string }) => `every ${s.every} ${s.unit}`;
// 1 Oct 2026 and 1 Jan 2027, 00:00 in Berlin.
const OCT = Date.UTC(2026, 8, 30, 22) / 1000;
const JAN = Date.UTC(2026, 11, 31, 23) / 1000;

test("a scheduled reset queued at the collector's start", () => {
  const detail = JSON.stringify({ startup: true, from: OCT, to: JAN, schedule: "3 month", inherited: true, zone: "Europe/Berlin", version: "1.4.0" });
  const o = parseJobOrigin("scheduled_resets", detail);
  assert.equal(o.feature, "scheduled_resets");
  assert.equal(o.startup, true);
  assert.equal(scheduleValue(o.schedule), "3 month");
  assert.deepEqual(originText(o, "schedule", "schedule", "en", sched), {
    source: "Reset schedule (features.scheduled_resets)",
    parts: ["period 1 Oct 2026 to 31 Dec 2026", "every 3 month (schedule for all rankings)", "queued at the collector's start"],
  });
  const de = originText({ ...o, startup: false, inherited: false }, "schedule", "schedule", "de", sched);
  assert.equal(de.source, "Reset-Zeitplan (features.scheduled_resets)");
  assert.deepEqual(de.parts, ["Periode 01.10.2026 bis 31.12.2026", "every 3 month (eigener Zeitplan des Rankings)", "angelegt, als die Periode endete"]);
});

test("daily jobs, console and web admin", () => {
  assert.deepEqual(originText(parseJobOrigin("daily_awards", '{"startup":true,"day":"2026-10-26"}'), "schedule", "schedule", "en", sched), {
    source: "Daily awards (features.daily_awards)",
    parts: ["queued at the collector's start, the day had no awards yet"],
  });
  assert.deepEqual(originText(parseJobOrigin("inactive_players", ""), "schedule", "schedule", "en", sched), {
    source: "Daily move of inactive players (features.inactive_players)",
    parts: [],
  });
  assert.deepEqual(originText(parseJobOrigin("cli", '{"command":"gamewe reset css1 -mode all"}'), "cli", "cli", "en", sched), {
    source: "Console",
    parts: ["gamewe reset css1 -mode all"],
  });
  assert.deepEqual(originText(parseJobOrigin("admin", ""), "dennis", "dennis", "en", sched), { source: "Web admin", parts: ["dennis"] });
  // The token's name only where the admin's name may show.
  const api = parseJobOrigin("api", webOriginDetail("deploy"));
  assert.deepEqual(originText(api, "dennis", "dennis", "en", sched), { source: "Admin API", parts: ["token “deploy”", "dennis"] });
  assert.deepEqual(originText(api, "dennis", "another admin", "en", sched), { source: "Admin API", parts: ["another admin"] });
});

test("jobs queued before the columns: only requested_by", () => {
  for (const [by, source] of [["schedule", "Collector schedule"], ["cli", "Console"]]) {
    const t = originText(parseJobOrigin("", ""), by, by, "en", sched);
    assert.equal(t.source, source);
    assert.match(t.parts[0], /no details/);
  }
  assert.deepEqual(originText(parseJobOrigin(null, null), "dennis", "dennis", "en", sched), { source: "Web admin", parts: ["dennis"] });
});

test("malformed details lose only the details", () => {
  const empty = parseJobOrigin("scheduled_resets", "");
  for (const d of ["{", "[]", "null", "5", '"x"']) assert.deepEqual(parseJobOrigin("scheduled_resets", d), empty, d);
  const o = parseJobOrigin("bogus", JSON.stringify({ from: JAN, to: OCT, zone: "Mars/Base", schedule: "fortnight", day: "26.10.2026", version: "<b>", command: "a\u0000b".repeat(100), token: 5 }));
  assert.equal(o.feature, "");
  assert.equal(o.from + o.to, 0);
  assert.equal(o.zone, "");
  assert.equal(o.schedule, null);
  assert.equal(o.day, "");
  assert.equal(o.version, "");
  assert.equal(o.token, "");
  assert.ok(o.command.length <= 200 && !o.command.includes("\u0000"));
  assert.equal(webOriginDetail(undefined), "");
  assert.equal(JSON.parse(webOriginDetail("x".repeat(100))).token.length, 64);
});
