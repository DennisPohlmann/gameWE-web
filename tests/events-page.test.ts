// Events page of a ranking: period, type filter, chart groups and shares.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { EVENT_GROUPS, FILTER_KINDS, PAGE_EVENT_KINDS, eventShares, eventStats, kindsOf, periodParam, periodRange, typeParam } from "../src/lib/events-page.ts";

test("unknown periods and types fall back to the defaults", () => {
  assert.equal(periodParam(undefined), "24h");
  assert.equal(periodParam("7d"), "7d");
  for (const v of ["", "30d", "constructor", "__proto__", "1H"]) assert.equal(periodParam(v), "24h", v);
  assert.equal(typeParam("kill"), "kill");
  for (const v of [undefined, "", "playeraction", "death", "chat", "kill'--"]) assert.equal(typeParam(v), "", String(v));
});

test("actions on a player count as actions; all types are every kind", () => {
  assert.deepEqual(kindsOf("action"), ["action", "playeraction"]);
  assert.deepEqual(kindsOf("kill"), ["kill"]);
  assert.deepEqual(kindsOf(""), [...PAGE_EVENT_KINDS]);
  assert.ok(!(FILTER_KINDS as readonly string[]).includes("playeraction"));
});

test("every kind is in exactly one chart group", () => {
  const all = EVENT_GROUPS.flatMap((g) => [...g.kinds]).sort();
  assert.deepEqual(all, [...PAGE_EVENT_KINDS].sort());
});

test("the range starts on a whole step and ends with the current one", () => {
  const now = 1_800_000_123;
  const r = periodRange("24h", now);
  assert.equal(r.from % 3600, 0);
  assert.ok(r.from <= now - 86_400);
  assert.equal(r.from + (r.n - 1) * r.step <= now, true);
  assert.equal(r.from + r.n * r.step > now, true);
  const h = periodRange("1h", now);
  assert.equal(h.step, 300);
  assert.equal(h.n, 13);
});

test("counts add up per type and per group; bad rows are left out", () => {
  const s = eventStats(
    [
      { kind: "kill", b: 0, n: 5 },
      { kind: "kill", b: "2", n: "3" },
      { kind: "playeraction", b: 1, n: 2 },
      { kind: "action", b: 1, n: 1 },
      { kind: "suicide", b: 2, n: 1 },
      { kind: "chat", b: 0, n: 9 },
      { kind: "kill", b: 3, n: 9 },
      { kind: "kill", b: -1, n: 9 },
    ],
    3,
  );
  assert.equal(s.total, 12);
  assert.equal(s.byType.kill, 8);
  assert.equal(s.byType.action, 3);
  assert.deepEqual(s.series.kills, [5, 0, 3]);
  assert.deepEqual(s.series.actions, [0, 3, 0]);
  assert.deepEqual(s.series.deaths, [0, 0, 1]);
  const sh = eventShares(s);
  assert.deepEqual(sh.map((x) => x.type), ["kill", "action", "suicide"]);
  assert.equal(sh.reduce((a, x) => a + x.share, 0), 1);
});

test("every new text of the page is in English and German", () => {
  for (const lang of ["en", "de"]) {
    const d = JSON.parse(readFileSync(`src/translations/${lang}.json`, "utf8"));
    for (const k of ["events", "eventsOverTime", "eventShares", "eventsTotal", "period", "eventsCapped"]) assert.equal(typeof d[k], "string", `${lang} ${k}`);
    assert.deepEqual(Object.keys(d.periods).sort(), ["1h", "24h", "7d"]);
    assert.deepEqual(Object.keys(d.evGroup).sort(), EVENT_GROUPS.map((g) => g.id).sort());
  }
});
