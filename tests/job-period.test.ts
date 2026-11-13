// Period of the reset page's job list (?from=, ?to=). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { jobPeriod } from "../src/lib/job-period.ts";

const now = new Date(2026, 10, 13, 21, 30);

test("the default is the last 14 days up to today", () => {
  const p = jobPeriod("", "", now);
  assert.deepEqual([p.from, p.to, p.invalid], ["2026-10-31", "2026-11-13", false]);
  assert.equal(p.start, new Date(2026, 9, 31).getTime() / 1000);
  assert.equal(p.end, new Date(2026, 10, 14).getTime() / 1000);
});

test("from and to are taken, a missing one is filled in", () => {
  assert.deepEqual([jobPeriod("2026-01-01", "2026-01-31", now)].map((p) => [p.from, p.to, p.invalid]), [["2026-01-01", "2026-01-31", false]]);
  assert.deepEqual([jobPeriod("", "2026-03-14", now)].map((p) => [p.from, p.to]), [["2026-03-01", "2026-03-14"]]);
  assert.deepEqual([jobPeriod("2026-11-01", "", now)].map((p) => [p.from, p.to]), [["2026-11-01", "2026-11-13"]]);
  assert.equal(jobPeriod("2026-11-13", "2026-11-13", now).end - jobPeriod("2026-11-13", "2026-11-13", now).start, 86400);
});

test("invalid input gives the default", () => {
  for (const [f, t] of [
    ["2026-02-30", ""],
    ["13.11.2026", ""],
    ["2026-11-10", "2026-11-01"],
    ["2024-01-01", "2026-01-01"],
    ["2026-1-1", ""],
    ["' OR 1=1", ""],
  ]) {
    const p = jobPeriod(f, t, now);
    assert.deepEqual([p.from, p.to, p.invalid], ["2026-10-31", "2026-11-13", true], `${f} ${t}`);
  }
  assert.equal(jobPeriod("2025-11-14", "2026-11-13", now).invalid, false); // 365 days
  assert.equal(jobPeriod("2025-11-12", "2026-11-13", now).invalid, true); // 367 days
});
