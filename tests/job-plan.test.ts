// The plan of the collector's jobs as the admin page Jobs reads it from
// hlstats_Options (written by the collector). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveSchedule, jobType, nextResetKey, parseNext, parsePlan, shortDuration } from "../src/lib/job-plan.ts";

test("a plan as the collector writes it", () => {
  assert.deepEqual(parsePlan('{"enabled":true,"time":"00:05","zone":"Europe/Berlin","next":1793142300}'), {
    enabled: true,
    time: "00:05",
    zone: "Europe/Berlin",
    next: 1793142300,
  });
  // Off: no next run.
  assert.deepEqual(parsePlan('{"enabled":false,"time":"01:00","zone":"UTC"}'), { enabled: false, time: "01:00", zone: "UTC", next: 0 });
});

test("missing or malformed plans are null, odd fields are dropped", () => {
  for (const v of [undefined, null, "", "x", "[]", "null", '{"enabled":"yes","time":"00:00"}', '{"enabled":true,"time":"0:0"}', '{"enabled":true}'])
    assert.equal(parsePlan(v), null, String(v));
  assert.deepEqual(parsePlan('{"enabled":true,"time":"02:00","zone":"<b>x</b>","next":-5}'), { enabled: true, time: "02:00", zone: "", next: 0 });
  assert.equal(parsePlan('{"enabled":true,"time":"02:00","next":1.5}')?.next, 0);
});

test("next reset of a ranking", () => {
  assert.equal(nextResetKey("css"), "gamewe_next_reset_css");
  assert.equal(parseNext("1793142300"), 1793142300);
  for (const v of [undefined, null, "", "abc", "-1", "0", "1.5"]) assert.equal(parseNext(v), 0, String(v));
});

test("the schedule the collector uses: own, off or the one for all rankings", () => {
  assert.deepEqual(effectiveSchedule("2 week", "month"), { unit: "week", every: 2, day: 1, month: 1 });
  assert.deepEqual(effectiveSchedule(undefined, "month"), { unit: "month", every: 1, day: 1, month: 1 });
  assert.deepEqual(effectiveSchedule(" ", "month"), { unit: "month", every: 1, day: 1, month: 1 });
  assert.equal(effectiveSchedule("off", "month"), null);
  assert.equal(effectiveSchedule("0", "month"), null);
  assert.equal(effectiveSchedule(undefined, ""), null);
  assert.equal(effectiveSchedule(undefined, "off"), null);
});

test("job types and durations", () => {
  assert.equal(jobType("awards"), "awards");
  assert.equal(jobType("scheduled-reset"), "scheduled-reset");
  assert.equal(jobType("other"), null);
  assert.equal(shortDuration(42, "en"), "42 s");
  assert.equal(shortDuration(12 * 60 + 5, "de"), "12 min");
  assert.equal(shortDuration(3 * 3600 + 5 * 60, "de"), "3 Std. 5 min");
  assert.equal(shortDuration(3 * 3600, "en"), "3 h");
  assert.equal(shortDuration(2 * 86400 + 4 * 3600, "en"), "2 d 4 h");
});
