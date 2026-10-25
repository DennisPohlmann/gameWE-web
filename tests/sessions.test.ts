// Sessions table of a player: sort keys, paging and the time column.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SESSION_SORT_DEFAULT, fmtSessionTime, sessionPage, sessionSortParam, sessionSorts, sortSessions, type SessionRow } from "../src/lib/sessions.ts";

const day = (eventTime: string, o: Partial<SessionRow> = {}): SessionRow => ({
  eventTime,
  skill: 1000,
  points_change: 0,
  connection_time: 0,
  rounds: 0,
  wins: 0,
  kills: 0,
  deaths: 0,
  kill_streak: 0,
  headshots: 0,
  shots: 0,
  hits: 0,
  ...o,
});

const rows = [
  day("2026-10-23", { points_change: 25, kills: 10, deaths: 5, headshots: 5, shots: 100, hits: 20 }),
  day("2026-10-25", { points_change: -12, kills: 4, deaths: 0, headshots: 1, shots: 0 }),
  day("2026-10-24", { points_change: 25, kills: 0, deaths: 3 }),
];
const days = (r: SessionRow[]) => r.map((x) => x.eventTime);

test("the default is the newest day first, dir=asc the oldest", () => {
  assert.equal(SESSION_SORT_DEFAULT, "date");
  assert.deepEqual(days(sortSessions(rows, "date", false)), ["2026-10-25", "2026-10-24", "2026-10-23"]);
  assert.deepEqual(days(sortSessions(rows, "date", true)), ["2026-10-23", "2026-10-24", "2026-10-25"]);
});

test("date sorts by the day, also when the driver returns a full timestamp", () => {
  const r = [day("2026-10-01 00:00:00"), day("2026-09-30T00:00:00.000Z")];
  assert.deepEqual(days(sortSessions(r, "date", false)), ["2026-10-01 00:00:00", "2026-09-30T00:00:00.000Z"]);
});

test("equal values keep the newest day on top in both directions", () => {
  assert.deepEqual(days(sortSessions(rows, "change", false)), ["2026-10-24", "2026-10-23", "2026-10-25"]);
  assert.deepEqual(days(sortSessions(rows, "change", true)), ["2026-10-25", "2026-10-24", "2026-10-23"]);
});

test("K/D without deaths is the kills, ratios without a basis sort last", () => {
  assert.deepEqual(days(sortSessions(rows, "kpd", false)), ["2026-10-25", "2026-10-23", "2026-10-24"]);
  assert.deepEqual(days(sortSessions(rows, "acc", false)), ["2026-10-23", "2026-10-25", "2026-10-24"]);
  assert.deepEqual(days(sortSessions(rows, "hpk", false)), ["2026-10-23", "2026-10-25", "2026-10-24"]);
});

test("sorting does not change the input", () => {
  const before = days(rows);
  sortSessions(rows, "kills", true);
  assert.deepEqual(days(rows), before);
});

test("numbers from the driver as strings sort as numbers", () => {
  const r = [day("2026-10-01", { kills: "9" as unknown as number }), day("2026-10-02", { kills: "10" as unknown as number })];
  assert.deepEqual(days(sortSessions(r, "kills", false)), ["2026-10-02", "2026-10-01"]);
});

test("every column has a sort key, unknown and inherited keys fall back", () => {
  assert.deepEqual(Object.keys(sessionSorts), ["date", "change", "points", "time", "rounds", "wins", "kills", "deaths", "kpd", "streak", "hs", "hpk", "acc"]);
  for (const k of Object.keys(sessionSorts)) assert.equal(sessionSortParam(k), k);
  for (const k of ["", "junk", "constructor", "toString", "__proto__", "DATE"]) assert.equal(sessionSortParam(k), "date");
});

test("paging: rows of the page, the page count, out of range pages", () => {
  const list = Array.from({ length: 55 }, (_, i) => i);
  assert.deepEqual(sessionPage(list, 1, 25), { page: 1, pages: 3, rows: list.slice(0, 25) });
  assert.deepEqual(sessionPage(list, 3, 25).rows, [50, 51, 52, 53, 54]);
  assert.equal(sessionPage(list, 9, 25).page, 3);
  assert.equal(sessionPage(list, 0, 25).page, 1);
  assert.deepEqual(sessionPage([], 1, 25), { page: 1, pages: 1, rows: [] });
  assert.equal(sessionPage(list, 1, 50).pages, 2);
});

test("time always shows the days", () => {
  assert.equal(fmtSessionTime(6660), "0d 01:51h");
  assert.equal(fmtSessionTime(0), "0d 00:00h");
  assert.equal(fmtSessionTime(null), "0d 00:00h");
  assert.equal(fmtSessionTime(86400 + 3600 * 3 + 59), "1d 03:00h");
  assert.equal(fmtSessionTime(-5), "0d 00:00h");
});
