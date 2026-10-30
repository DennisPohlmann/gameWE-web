// Player and clan counts of the start page's "General statistics".
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { allClansSql, allKillsSql, allPlayersSql, playersPerRanking, playersPerRankingSql } from "../src/lib/general-stats.ts";

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

test("kills and headshots count active and inactive players, each player once", () => {
  assert.match(allKillsSql, /FROM hlstats_Players p JOIN hlstats_Games g ON g\.code = p\.game AND g\.hidden = '0'/);
  assert.match(allKillsSql, /FROM hlstats_PlayersInactive i JOIN hlstats_Games g ON g\.code = i\.game AND g\.hidden = '0'/);
  assert.match(allKillsSql, /UNION ALL/);
  assert.match(allKillsSql, /WHERE NOT EXISTS \(SELECT 1 FROM hlstats_Players p WHERE p\.playerId = i\.playerId\)/);
  assert.doesNotMatch(allKillsSql, /hideranking/);
});

test("players per ranking (Admin > Rankings): both tables, each player once, without bots", () => {
  assert.match(playersPerRankingSql.active, /FROM hlstats_Players p GROUP BY TRIM\(p\.game\)/);
  assert.match(playersPerRankingSql.inactive, /FROM hlstats_PlayersInactive i GROUP BY TRIM\(i\.game\)/);
  assert.match(playersPerRankingSql.both, /JOIN hlstats_PlayersInactive i ON i\.playerId = p\.playerId/);
  assert.match(playersPerRankingSql.bots, /u\.uniqueId LIKE 'BOT%'/);
  for (const q of Object.values(playersPerRankingSql)) assert.doesNotMatch(q, /hideranking/);
  const m = playersPerRanking({
    active: [{ game: "css", n: 10 }, { game: "tf", n: "3" }],
    inactive: [{ game: "css", n: 1530 }],
    both: [{ game: "css", n: 1 }],
    bots: [{ game: "css", n: 8 }, { game: "tf", n: 5 }],
  });
  assert.equal(m.get("css"), 10 + 1530 - 1 - 8);
  // Never below 0 (bots counted while players were moved).
  assert.equal(m.get("tf"), 0);
  assert.equal(m.get("dod"), undefined);
});

test("the admin lists of rankings and a ranking's page show all its players", () => {
  for (const f of ["src/app/admin/(panel)/rankings/page.tsx", "src/app/admin/(panel)/page.tsx"]) {
    const page = readFileSync(f, "utf8");
    assert.match(page, /playersByRanking\(\)/, f);
    assert.doesNotMatch(page, /countByRanking\("hlstats_Players"/, f);
  }
  assert.match(readFileSync("src/app/admin/(panel)/rankings/[code]/page.tsx", "utf8"), /v=\{nf\(allPlayers\)\}/);
});
