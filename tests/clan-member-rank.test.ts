// The ranking table's career rank column reads careerKills of each row: every
// query that loads RankingRows (ranking and clan members) must select it, or
// the column shows only dashes. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("every RankingRow query selects careerKills", () => {
  const src = readFileSync("src/lib/data.ts", "utf8");
  const queries = src.split("query<RankingRow>(").slice(1).map((q) => q.slice(0, q.indexOf("`,")));
  assert.match(src, /const cols = `SELECT [^`]*AS careerKills/, "getRanking's cols");
  assert.ok(queries.length >= 4, "ranking and clan member queries found");
  for (const q of queries) assert.match(q, /AS careerKills|\$\{cols\}/, q.slice(0, 120));
});
