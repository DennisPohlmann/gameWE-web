// The admin's players list sorted by name: equal names in player id order (in
// the name's direction), so the index lastName (collector schema 30) serves
// the order; the whole list walks it in each table up to a page limit
// (src/lib/admin-data.ts, src/lib/name-order.ts). Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { ADMIN_NAME_INDEX_MAX_OFFSET } from "../src/lib/name-order";

const data = readFileSync("src/lib/admin-data.ts", "utf8");
const listRows = data.slice(data.indexOf("export async function listRows("), data.indexOf("\n}\n", data.indexOf("export async function listRows(")));

test("by name, equal names go by player id in the same direction", () => {
  assert.match(listRows, /const byName = !!e\.alsoTable && sortCol === "d\.lastName";/);
  assert.match(listRows, /\? `d\.lastName \$\{dir\}, t\.\$\{e\.pk\} \$\{dir\}`/);
});

test("the index path only for the whole list, early pages and with the index", () => {
  assert.match(listRows, /if \(byName && !where && offset <= ADMIN_NAME_INDEX_MAX_OFFSET && \(await indexedNames\(\)\) > 0\)/);
  assert.equal(ADMIN_NAME_INDEX_MAX_OFFSET, 10_000);
  // Each table along the index, a player in both tables once (as in the union).
  assert.match(listRows, /FROM hlstats_Players_Data d STRAIGHT_JOIN \$\{table\} t ON t\.\$\{e\.pk\} = d\.playerId/);
  assert.match(listRows, /WHERE NOT EXISTS \(SELECT 1 FROM \$\{e\.table\} m WHERE m\.\$\{e\.pk\} = t\.\$\{e\.pk\}\)/);
  assert.match(listRows, /\[n, n, size \+ 1, offset\]/);
});

test("the index lookup is shared with the public pages (MariaDB only)", () => {
  const d = readFileSync("src/lib/data.ts", "utf8");
  assert.match(d, /export function indexedNames\(\): Promise<number> \{\s*if \(dialect\(\) !== "mariadb"\) return Promise\.resolve\(0\);/);
});
