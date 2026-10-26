// Periods of the scheduled ranking resets (hall of fame): the schedule as the
// collector reads it, the names of the periods and the next reset. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { nextStart, parseSchedule, periodLabel, scheduleValue, type HallPeriod } from "../src/lib/hall-period.ts";

test("schedules parse as in the collector", () => {
  assert.deepEqual(parseSchedule("month"), { unit: "month", every: 1 });
  assert.deepEqual(parseSchedule(" 2 Months "), { unit: "month", every: 2 });
  assert.deepEqual(parseSchedule("quarter"), { unit: "month", every: 3 });
  assert.deepEqual(parseSchedule("2 quarter"), { unit: "month", every: 6 });
  assert.deepEqual(parseSchedule("3 day"), { unit: "day", every: 3 });
  for (const v of ["", "off", "0", "0 month", "121 day", "50 quarter", "fortnight", "2 3 month", "-1 week"]) assert.equal(parseSchedule(v), null, v);
  assert.equal(scheduleValue(parseSchedule("1 week")), "week");
  assert.equal(scheduleValue(parseSchedule("quarter")), "3 month");
  assert.equal(scheduleValue(null), "");
});

const p = (unit: HallPeriod["unit"], every: number, start: string, end: string): HallPeriod => ({ unit, every, start, end });

test("period names", () => {
  const de = (r: HallPeriod, short = false) => periodLabel(r, "de-DE", "KW {n}", short);
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
