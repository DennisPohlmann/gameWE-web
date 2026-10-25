// Sorting of tables by their column heads: keys only from the allowlists,
// fallbacks, directions and the order of loaded rows. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { awardWinSorts, ipSortKey, ipSorts, isSortKey, rankPlayerSorts, sortRows, sortState, timeSorts } from "../src/lib/table-sort.ts";

const sorts = { kills: "p.kills", name: "d.lastName" } as const;

test("a known key is used, descending unless dir=asc", () => {
  assert.deepEqual(sortState({ sort: "name" }, sorts, "kills"), { sort: "name", asc: false, keep: { sort: "name", dir: undefined } });
  assert.deepEqual(sortState({ sort: "name", dir: "asc" }, sorts, "kills"), { sort: "name", asc: true, keep: { sort: "name", dir: "asc" } });
  assert.equal(sortState({ sort: ["name", "kills"] }, sorts, "kills").sort, "name");
  assert.equal(sortState({ sort: " name " }, sorts, "kills").sort, "name");
});

test("unknown, inherited and hostile keys fall back to the default", () => {
  for (const k of ["", "junk", "KILLS", "constructor", "toString", "__proto__", "hasOwnProperty", "kills; DROP TABLE x", "p.kills", "x".repeat(500)]) {
    const s = sortState({ sort: k, dir: "asc" }, sorts, "kills");
    assert.equal(s.sort, "kills", k);
    // The default keeps its own direction, and the links carry nothing.
    assert.equal(s.asc, false, k);
    assert.deepEqual(s.keep, {}, k);
  }
  assert.equal(isSortKey(sorts, "toString"), false);
  assert.equal(isSortKey(sorts, "kills"), true);
});

test("a table can default to ascending", () => {
  assert.equal(sortState({}, sorts, "name", { asc: true }).asc, true);
  // A chosen column uses dir, also for the default column.
  assert.equal(sortState({ sort: "name" }, sorts, "name", { asc: true }).asc, false);
});

test("a second table on the page reads its own params", () => {
  const sp = { sort: "name", dir: "asc", dsort: "kills" };
  const s = sortState(sp, sorts, "name", { sortParam: "dsort", dirParam: "ddir" });
  assert.deepEqual(s, { sort: "kills", asc: false, keep: { dsort: "kills", ddir: undefined } });
  assert.equal(sortState(sp, sorts, "kills").sort, "name");
});

test("loaded rows sort by the value, stable, empty values last", () => {
  const rows = [
    { id: 1, n: 5, s: "b" },
    { id: 2, n: null, s: "" },
    { id: 3, n: 5, s: "A" },
    { id: 4, n: 9, s: "c" },
    { id: 5, n: Number.NaN, s: "a" },
  ];
  const values = { n: (r: (typeof rows)[number]) => r.n, s: (r: (typeof rows)[number]) => r.s };
  assert.deepEqual(sortRows(rows, values, "n", false).map((r) => r.id), [4, 1, 3, 2, 5]);
  assert.deepEqual(sortRows(rows, values, "n", true).map((r) => r.id), [1, 3, 4, 2, 5]);
  // Case does not count; equal names keep the loaded order.
  assert.deepEqual(sortRows(rows, values, "s", true).map((r) => r.id), [3, 5, 1, 4, 2]);
  assert.deepEqual(sortRows(rows, values, "s", false).map((r) => r.id), [4, 1, 3, 5, 2]);
  // The input is not changed.
  assert.deepEqual(rows.map((r) => r.id), [1, 2, 3, 4, 5]);
});

test("numbers in names sort as numbers", () => {
  const rows = [{ m: "de_dust10" }, { m: "de_dust2" }];
  assert.deepEqual(sortRows(rows, { m: (r: { m: string }) => r.m }, "m", true).map((r) => r.m), ["de_dust2", "de_dust10"]);
});

test("addresses sort in address order", () => {
  const ips = ["10.0.0.1", "9.255.0.1", "-", "192.168.0.10", "192.168.0.9"];
  const sorted = sortRows(ips, { ip: (v: string) => ipSortKey(v) }, "ip", true);
  assert.deepEqual(sorted, ["9.255.0.1", "10.0.0.1", "192.168.0.9", "192.168.0.10", "-"]);
  assert.equal(ipSortKey(""), null);
});

test("the SQL sort maps hold only column expressions", () => {
  // Every value ends up in ORDER BY: identifiers, numbers and the ratio
  // helpers only, no quotes, comments or statement separators.
  for (const map of [rankPlayerSorts, awardWinSorts, ipSorts]) {
    for (const [k, v] of Object.entries(map)) {
      assert.match(k, /^[a-z]+$/, k);
      assert.match(v, /^[A-Za-z_][A-Za-z0-9_.]*$/, `${k}: ${v}`);
    }
  }
  assert.deepEqual(Object.keys(timeSorts), ["date"]);
});

test("the defaults are keys of their maps", () => {
  assert.ok(isSortKey(rankPlayerSorts, "kills"));
  assert.ok(isSortKey(awardWinSorts, "date"));
  assert.ok(isSortKey(ipSorts, "last"));
});
