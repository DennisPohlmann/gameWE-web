// DB_TABLE_PREFIX: the queries' hlstats_ names are rewritten to the prefix
// of the database (the collector's database.table_prefix). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTablePrefix, prefixSql, prefixTable } from "../src/lib/table-prefix.ts";

test("the prefix is checked and normalized", () => {
  for (const [input, want] of [[undefined, "hlstats"], ["", "hlstats"], ["hlstats_", "hlstats"], ["gw", "gw"], ["gw_", "gw"], ["My_Stats2", "My_Stats2"]] as const) {
    assert.equal(normalizeTablePrefix(input), want, String(input));
  }
  for (const bad of ["2gw", "g-w", "g w", "gw__", "hlstats_ce", "gamewe", "abcdefghijklmnopq", "gw;DROP"]) {
    assert.throws(() => normalizeTablePrefix(bad), /DB_TABLE_PREFIX/, bad);
  }
});

test("table names are rewritten, literals and comments are not", () => {
  const cases: [string, string][] = [
    ["SELECT * FROM hlstats_Players WHERE playerId = ?", "SELECT * FROM gw_Players WHERE playerId = ?"],
    ["SELECT p.name FROM hlstats_Players p JOIN hlstats_Games g ON g.code = p.game", "SELECT p.name FROM gw_Players p JOIN gw_Games g ON g.code = p.game"],
    ["UPDATE `hlstats_Servers` SET x = 1", "UPDATE `gw_Servers` SET x = 1"],
    ["SELECT keyname FROM HLSTATS_Options WHERE keyname = 'hlstats_x'", "SELECT keyname FROM gw_Options WHERE keyname = 'hlstats_x'"],
    ["SELECT 'it''s hlstats_x' FROM hlstats_Options", "SELECT 'it''s hlstats_x' FROM gw_Options"],
    ["SELECT 1 -- hlstats_Players\nFROM hlstats_Options", "SELECT 1 -- hlstats_Players\nFROM gw_Options"],
    ["SELECT 1 /* hlstats_Players */ FROM hlstats_Options", "SELECT 1 /* hlstats_Players */ FROM gw_Options"],
    ["SELECT my_hlstats_x, xhlstats_y FROM hlstats_Teams", "SELECT my_hlstats_x, xhlstats_y FROM gw_Teams"],
    ["SELECT 1", "SELECT 1"],
  ];
  for (const [sql, want] of cases) assert.equal(prefixSql("gw", sql), want, sql);
  const q = "SELECT * FROM hlstats_Players";
  assert.equal(prefixSql("hlstats", q), q);
  assert.equal(prefixTable("gw", "hlstats_gamewe_jobs"), "gw_gamewe_jobs");
  assert.equal(prefixTable("hlstats", "hlstats_Players"), "hlstats_Players");
});
