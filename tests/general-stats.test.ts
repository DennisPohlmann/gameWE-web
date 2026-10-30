// Player and clan counts of the start page's "General statistics".
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { allClansSql, allKillsSql, adminPlayerTotalsSql, allPlayersSql, playersPerRanking, playersPerRankingSql, rankingClansSql, rankingKillsSql, rankingPlayersSql } from "../src/lib/general-stats.ts";

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

test("a ranking's clans are those of its public lists: two visible members or more", () => {
  assert.match(rankingClansSql, /FROM hlstats_Players WHERE game = \? AND hideranking = 0 AND clan > 0/);
  assert.match(rankingClansSql, /UNION ALL SELECT clan FROM hlstats_PlayersInactive WHERE game = \? AND hideranking = 0 AND clan > 0/);
  assert.match(rankingClansSql, /JOIN hlstats_Clans c ON c\.clanId = m\.clan GROUP BY m\.clan HAVING COUNT\(\*\) >= 2/);
  assert.equal(rankingClansSql.match(/\?/g)?.length, 2);
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

test("the line at the top of a ranking's page counts from the players, all of them", () => {
  // The same counts for one ranking: one placeholder per table.
  assert.equal(rankingPlayersSql.match(/g\.code = \?/g)?.length, 4);
  assert.equal(rankingPlayersSql.replace(/g\.code = \?/g, "g.hidden = '0'"), allPlayersSql);
  assert.equal(rankingKillsSql.match(/g\.code = \?/g)?.length, 2);
  assert.equal(rankingKillsSql.replace(/g\.code = \?/g, "g.hidden = '0'"), allKillsSql);
  // Not from the servers' counters, which a player stats reset keeps.
  const data = readFileSync("src/lib/data.ts", "utf8");
  const load = data.slice(data.indexOf("async function loadTotals"), data.indexOf("export type LivePlayer"));
  assert.match(load, /queryOne<\{ n: number \| string \}>\(rankingPlayersSql, \[game, game, game, game\]\)/);
  assert.match(load, /rankingKillsSql, \[game, game\]/);
  assert.doesNotMatch(load, /SUM\(kills\)|SUM\(headshots\)/);
  assert.doesNotMatch(load, /FROM hlstats_Players WHERE game = \?/);
});

test("the admin overview counts the hidden and today's players without bots", () => {
  assert.equal(adminPlayerTotalsSql.match(/\?/g)?.length, 2);
  assert.equal(adminPlayerTotalsSql.match(/u\.uniqueId LIKE 'BOT%'/g)?.length, 2);
  assert.match(adminPlayerTotalsSql, /p\.hideranking <> 0\) -/);
});
