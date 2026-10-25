// Player trend: every calendar day, the bars are the steps of the line.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { dayChanges, pointsTrend } from "../src/lib/points-trend.ts";

test("the change is the step of the line, also when skill_change disagrees", () => {
  const days = pointsTrend(
    [
      { day: "2026-10-23", skill: 4914, change: 100 },
      { day: "2026-10-24", skill: 15580, change: 9000 },
      { day: "2026-10-25", skill: 16295, change: 700 },
    ],
    4000,
    "2026-10-25",
  );
  assert.deepEqual(
    days.map((d) => [d.day, d.points, d.change]),
    [
      ["2026-10-23", 4914, 914],
      ["2026-10-24", 15580, 10666],
      ["2026-10-25", 16295, 715],
    ],
  );
});

test("without an earlier day the first day's own change is the start", () => {
  const [d] = pointsTrend([{ day: "2026-10-23", skill: 1040, change: 40 }], null, "2026-10-23");
  assert.deepEqual([d.points, d.change, d.played], [1040, 40, true]);
});

test("days without play keep the points, with no change, up to today", () => {
  const days = pointsTrend(
    [
      { day: "2026-10-28", skill: 1200, change: 200 },
      { day: "2026-10-31", skill: 1100, change: -100 },
    ],
    1000,
    "2026-11-02",
  );
  assert.deepEqual(
    days.map((d) => [d.day, d.points, d.change, d.played]),
    [
      ["2026-10-28", 1200, 200, true],
      ["2026-10-29", 1200, 0, false],
      ["2026-10-30", 1200, 0, false],
      ["2026-10-31", 1100, -100, true],
      ["2026-11-01", 1100, 0, false],
      ["2026-11-02", 1100, 0, false],
    ],
  );
  // The bars add up to the line's whole climb.
  assert.equal(days.reduce((n, d) => n + d.change, 0), 1100 - 1000);
});

test("no history, no days; never more than a year", () => {
  assert.deepEqual(pointsTrend([], 1000, "2026-10-25"), []);
  assert.equal(pointsTrend([{ day: "2020-01-01", skill: 1, change: 0 }], null, "2026-10-25").length, 366);
});

test("sessions and API: the same change, newest first, across page edges", () => {
  // Days of the trend test above, newest first; the page ends before the
  // oldest day, so its row is the "older" one.
  const page = [
    { skill: 16295, change: 700 },
    { skill: 15580, change: 9000 },
  ];
  assert.deepEqual(dayChanges(page, 4914), [715, 10666]);
  // The oldest day of all: its own recorded change.
  assert.deepEqual(dayChanges([{ skill: 1040, change: 40 }], null), [40]);
  // Matches pointsTrend on the played days.
  const rows = [
    { day: "2026-10-28", skill: 1200, change: 150 },
    { day: "2026-10-31", skill: 1100, change: -90 },
  ];
  const trend = pointsTrend(rows, 1000, "2026-10-31").filter((d) => d.played).map((d) => d.change);
  assert.deepEqual(dayChanges([...rows].reverse(), 1000).reverse(), trend);
  assert.deepEqual(dayChanges([], null), []);
});
