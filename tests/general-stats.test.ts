// Player and clan counts of the start page's "General statistics".
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { allClansSql, allPlayersSql } from "../src/lib/general-stats.ts";

test("players count active and inactive players, without a hideranking filter", () => {
  assert.match(allPlayersSql, /FROM hlstats_Players p JOIN hlstats_Games/);
  assert.match(allPlayersSql, /FROM hlstats_PlayersInactive i JOIN hlstats_Games/);
  // A player in both tables (crash between the steps) counts once.
  assert.match(allPlayersSql, /-\s+\(SELECT COUNT\(\*\) FROM hlstats_Players p JOIN hlstats_PlayersInactive i ON i\.playerId = p\.playerId/);
  // Bots stay out.
  assert.match(allPlayersSql, /-\s+\(SELECT COUNT\(DISTINCT u\.playerId\) FROM hlstats_PlayerUniqueIds u .*\n\s*WHERE u\.uniqueId LIKE 'BOT%'/);
  assert.doesNotMatch(allPlayersSql, /hideranking/);
  // Only visible games count.
  assert.equal(allPlayersSql.match(/g\.hidden = '0'/g)?.length, 4);
});

test("clans count every clan of the visible games, members or not", () => {
  assert.match(allClansSql, /FROM hlstats_Clans c JOIN hlstats_Games g ON g\.code = c\.game AND g\.hidden = '0'/);
  assert.doesNotMatch(allClansSql, /hlstats_Players|HAVING|GROUP BY|c\.hidden/);
});
