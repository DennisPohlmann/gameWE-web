// Country, state and city filters of the ranking, the country rankings and the
// players map (src/lib/data.ts): on MariaDB the plain column (case-insensitive
// collation, index usable) and no forced join order; PostgreSQL keeps LOWER().
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const data = readFileSync("src/lib/data.ts", "utf8");
const body = (name: string) => {
  const start = data.indexOf(`function ${name}(`);
  assert.ok(start > 0, name);
  return data.slice(start, data.indexOf("\n}\n", start));
};

test("place joins let the planner choose the order", () => {
  const s = body("placeJoins");
  assert.doesNotMatch(s, /STRAIGHT_JOIN/);
  assert.match(s, /JOIN hlstats_Players_Data d ON d\.location_id = l\.id/);
});

test("a place value is compared without LOWER except on PostgreSQL", () => {
  const s = body("placeIs");
  assert.match(s, /dialect\(\) !== "postgres" \? `\$\{col\} = \?` : `LOWER\(\$\{col\}\) = \?`/);
});

test("no filter of the ranking, the place ranking or the map wraps a place column in LOWER", () => {
  for (const fn of ["loadRanking", "loadPlaceRanking", "loadMapPlayers"]) {
    const s = body(fn);
    assert.doesNotMatch(s, /LOWER\(l\.(flag|state|city)\) = \?/, fn);
  }
  assert.equal(data.match(/placeIs\("l\.(flag|state|city)"\)/g)?.length, 7);
});
