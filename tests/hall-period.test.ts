// Periods of the scheduled ranking resets (hall of fame): the schedule as the
// collector reads it, the names of the periods and the next reset. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { lastStart, nextStart, podium, parseSchedule, periodLabel, scheduleValue, type HallPeriod } from "../src/lib/hall-period.ts";

test("schedules parse as in the collector", () => {
  const s = (unit: string, every: number, day = 1, month = 1) => ({ unit, every, day, month });
  assert.deepEqual(parseSchedule("month"), s("month", 1));
  assert.deepEqual(parseSchedule(" 2 Months "), s("month", 2));
  assert.deepEqual(parseSchedule("quarter"), s("month", 3));
  assert.deepEqual(parseSchedule("2 quarter"), s("month", 6));
  assert.deepEqual(parseSchedule("3 day"), s("day", 3));
  assert.deepEqual(parseSchedule("month@15"), s("month", 1, 15));
  assert.deepEqual(parseSchedule("quarter@15"), s("month", 3, 15));
  assert.deepEqual(parseSchedule("week@3"), s("week", 1, 3));
  assert.deepEqual(parseSchedule("2 year@07-01"), s("year", 2, 1, 7));
  for (const v of ["", "off", "0", "0 month", "121 day", "50 quarter", "fortnight", "2 3 month", "-1 week", "month@29", "month@0", "day@2", "week@8", "year@02-30", "year@13-01", "year@7", "month@1-2"])
    assert.equal(parseSchedule(v), null, v);
  for (const [v, want] of [["1 week", "week"], ["quarter", "3 month"], ["month@1", "month"], ["month@15", "month@15"], ["week@3", "week@3"], ["2 year@7-1", "2 year@07-01"], ["year@01-01", "year"]])
    assert.equal(scheduleValue(parseSchedule(v)), want, v);
  assert.equal(scheduleValue(null), "");
});

const p = (unit: HallPeriod["unit"], every: number, start: string, end: string): HallPeriod => ({ unit, every, start, end });

test("period names", () => {
  const de = (r: HallPeriod, short = false) => periodLabel(r, "de-DE", "KW {n}", short).replace(/\s/g, " ");
  assert.equal(de(p("month", 1, "2026-09-01", "2026-09-30")), "September 2026");
  assert.equal(de(p("month", 2, "2026-09-01", "2026-10-31")), "Sept.–Okt. 2026");
  assert.equal(de(p("month", 3, "2026-07-01", "2026-09-30")), "Q3 2026");
  assert.equal(de(p("week", 1, "2026-10-19", "2026-10-25")), "KW 43 2026");
  assert.equal(de(p("week", 2, "2026-10-19", "2026-11-01")), "KW 43–44 2026");
  assert.equal(de(p("week", 1, "2027-01-04", "2027-01-10")), "KW 1 2027");
  assert.equal(de(p("week", 1, "2026-12-28", "2027-01-03")), "KW 53 2026");
  assert.equal(de(p("day", 1, "2026-10-26", "2026-10-26")), "26. Oktober 2026");
  assert.equal(de(p("year", 1, "2026-01-01", "2026-12-31")), "2026");
  assert.equal(de(p("year", 2, "2026-01-01", "2027-12-31")), "2026–2027");
  assert.equal(de(p("month", 1, "2026-10-15", "2026-11-14")), "15. Okt. – 14. Nov. 2026");
  assert.equal(de(p("week", 1, "2026-10-21", "2026-10-27")), "21.–27. Okt. 2026");
});

test("next reset from the start of the running period", () => {
  // Local midnight of 2026-10-01 in Berlin (UTC+2) and in New York (UTC-4).
  const berlin = Date.UTC(2026, 8, 30, 22) / 1000;
  const ny = Date.UTC(2026, 9, 1, 4) / 1000;
  assert.equal(nextStart(berlin, { unit: "month", every: 1 }), "2026-11-01");
  assert.equal(nextStart(ny, { unit: "month", every: 3 }), "2027-01-01");
  assert.equal(nextStart(berlin, { unit: "day", every: 1 }), "2026-10-02");
  assert.equal(nextStart(Date.UTC(2026, 9, 19) / 1000, { unit: "week", every: 2 }), "2026-11-02");
  assert.equal(nextStart(Date.UTC(2026, 0, 1) / 1000, { unit: "year", every: 1 }), "2027-01-01");
});

test("start of the running period as the collector stores it", () => {
  assert.equal(lastStart("1790805600 month@15"), 1790805600);
  assert.equal(lastStart("1790805600"), 1790805600);
  for (const v of ["", null, undefined, "x month"]) assert.equal(lastStart(v), 0);
});

test("podium: removed and hidden entries make the next ones move up", () => {
  const e = (stored: number, removed = false, hidden = false) => ({ stored, removed, hidden });
  const places = (xs: ReturnType<typeof e>[]) => podium(xs).map((x) => `${x.place}:${x.stored}`).join(" ");
  assert.equal(places([e(1), e(2), e(3), e(4), e(5)]), "1:1 2:2 3:3");
  assert.equal(places([e(1), e(2, true), e(3), e(4), e(5)]), "1:1 2:3 3:4");
  assert.equal(places([e(5), e(1, false, true), e(2), e(3, true), e(4)]), "1:2 2:4 3:5");
  assert.equal(places([e(1), e(2, true), e(3)]), "1:1 2:3"); // collector 0.19: three stored
  assert.equal(places([e(1, true)]), "");
});
