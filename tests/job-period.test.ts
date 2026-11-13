// Period of the reset page's job list (?from=, ?to=). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { jobPeriod } from "../src/lib/job-period.ts";

test("without dates there is no time limit", () => {
  assert.deepEqual(jobPeriod("", ""), { from: "", to: "", start: undefined, end: undefined, invalid: false });
});

test("from and to are taken, each on its own too", () => {
  const p = jobPeriod("2026-11-01", "2026-11-13");
  assert.deepEqual([p.from, p.to, p.invalid], ["2026-11-01", "2026-11-13", false]);
  assert.equal(p.start, new Date(2026, 10, 1).getTime() / 1000);
  assert.equal(p.end, new Date(2026, 10, 14).getTime() / 1000);
  assert.equal(jobPeriod("2026-11-13", "2026-11-13").end! - jobPeriod("2026-11-13", "2026-11-13").start!, 86400);
  assert.deepEqual([jobPeriod("2026-11-01", "")].map((x) => [x.start !== undefined, x.end]), [[true, undefined]]);
  assert.deepEqual([jobPeriod("", "2026-11-13")].map((x) => [x.start, x.end !== undefined]), [[undefined, true]]);
});

test("invalid input gives no limit", () => {
  for (const [f, t] of [
    ["2026-02-30", ""],
    ["13.11.2026", ""],
    ["2026-11-10", "2026-11-01"],
    ["2026-1-1", ""],
    ["", "x"],
    ["' OR 1=1", ""],
  ]) {
    assert.deepEqual(jobPeriod(f, t), { from: "", to: "", invalid: true }, `${f} ${t}`);
  }
});
