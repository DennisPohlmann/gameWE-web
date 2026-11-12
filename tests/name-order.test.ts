// A ranking sorted by name reads the names along the index lastName
// (collector schema 30) only when that reads few rows (src/lib/name-order.ts),
// and only when the database has the index (src/lib/data.ts). Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { NAME_INDEX_MAX_ROWS, nameIndexPays } from "../src/lib/name-order";

test("large share and early pages use the index, small share or deep pages sort", () => {
  // 386k of 500k names (inactive css5): page 1 and offset 5000 read few rows.
  assert.equal(nameIndexPays(0, 50, 386_000, 500_000), true);
  assert.equal(nameIndexPays(5000, 50, 386_000, 500_000), true);
  // The last page of the same list reads nearly the whole index.
  assert.equal(nameIndexPays(385_950, 50, 386_000, 500_000), false);
  // 2k of 500k names: page 1 would read about 12,500 rows if the names were
  // spread evenly; at offset 1000 too many.
  assert.equal(nameIndexPays(0, 50, 2_000, 500_000), true);
  assert.equal(nameIndexPays(1_000, 50, 2_000, 500_000), false);
  // 52k of 500k (css): up to about offset 2000 yes, offset 5000 no.
  assert.equal(nameIndexPays(2000, 50, 52_000, 500_000), true);
  assert.equal(nameIndexPays(5000, 50, 52_000, 500_000), false);
  assert.equal(NAME_INDEX_MAX_ROWS, 20_000);
});

test("no count, no rows or no index: sort as before", () => {
  assert.equal(nameIndexPays(0, 50, 0, 500_000), false);
  assert.equal(nameIndexPays(0, 50, 100, 0), false);
  assert.equal(nameIndexPays(0, 50, Number.NaN, 500_000), false);
});

test("the ranking reads from the names only with the index, on MariaDB, without a place filter", () => {
  const s = readFileSync("src/lib/data.ts", "utf8");
  // Not with a place filter (its own join order) nor a name search (matches gather in the alphabet).
  assert.match(s, /const names = rankingSorts\[opts\.sort\] === "d\.lastName" && !local && !opts\.search \? await indexedNames\(\) : 0;/);
  assert.match(s, /FROM hlstats_Players_Data d STRAIGHT_JOIN \$\{table\} p ON p\.playerId = d\.playerId/);
  assert.match(s, /if \(dialect\(\) !== "mariadb"\) return Promise\.resolve\(0\);/);
  assert.match(s, /s\.INDEX_NAME = 'lastName' AND s\.SEQ_IN_INDEX = 1 AND s\.COLUMN_NAME = 'lastName'/);
  // Names far from even (the test data: a small ranking's names all at the
  // end of the alphabet) stop after NAME_INDEX_MAX_EXAMINED rows, and a short
  // page or an error (MySQL has no ROWS EXAMINED) falls back to the old sort.
  assert.match(s, /LIMIT \? OFFSET \? ROWS EXAMINED \$\{NAME_INDEX_MAX_EXAMINED\}/);
  assert.match(s, /\.catch\(\(\) => null\);\s*return got && got\.length >= want \? got : page\(where, opts\.limit, opts\.offset\);/);
  // The table name goes in as data, with the prefix of DB_TABLE_PREFIX.
  assert.match(s, /\[tableName\("hlstats_Players_Data"\)\]/);
});
