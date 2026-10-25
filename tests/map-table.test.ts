// Sorting and kills per minute of the player table on a map page. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { kpm, mapSort } from "../src/lib/map-table.ts";

test("default is most kills first", () => {
  assert.deepEqual(mapSort("", ""), { sort: "kills", flipped: false, desc: true });
  assert.deepEqual(mapSort("kills", "asc"), { sort: "kills", flipped: true, desc: false });
});

test("unknown sort keys fall back to kills", () => {
  for (const bad of ["skill; DROP TABLE x", "SUM(x.k)", "constructor", "__proto__", "KILLS", "x".repeat(200)]) {
    assert.equal(mapSort(bad, "").sort, "kills");
  }
});

test("numbers biggest first, names A to Z", () => {
  for (const k of ["deaths", "kpd", "hs", "hpk"]) assert.equal(mapSort(k, "").desc, true);
  assert.equal(mapSort("name", "").desc, false);
  assert.equal(mapSort("name", "asc").desc, true);
});

test("position: best place (most points) first, flipped worst first", () => {
  assert.deepEqual(mapSort("position", ""), { sort: "position", flipped: false, desc: true });
  assert.deepEqual(mapSort("position", "asc"), { sort: "position", flipped: true, desc: false });
});

test("only dir=asc flips", () => {
  assert.equal(mapSort("kills", "desc").desc, true);
  assert.equal(mapSort("kills", "ASC").desc, true);
});

test("kills per minute of play time", () => {
  assert.equal(kpm(120, 600), 12);
  assert.equal(kpm(0, 600), 0);
  assert.equal(kpm(10, 0), null);
  assert.equal(kpm(10, -5), null);
});
