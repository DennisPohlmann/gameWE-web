// The search (header tab "Search", /search and /api/v1/search/players) finds
// every visible player: active ones, those the collector moved to
// hlstats_PlayersInactive, and new ones without stats, with and without a
// chosen ranking. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const data = readFileSync("src/lib/data.ts", "utf8");
const body = (name: string) => {
  const start = data.indexOf(`function ${name}(`);
  assert.ok(start > 0, name);
  return data.slice(start, data.indexOf("\n}\n", start));
};

test("names and Steam IDs go through the same player lookup", () => {
  const s = body("searchPlayers");
  assert.equal(s.match(/searchHits\(/g)?.length, 2);
  assert.match(s, /FROM hlstats_PlayerNames WHERE name \$\{likeOp\(\)\} \? GROUP BY playerId/);
  assert.match(s, /FROM hlstats_PlayerUniqueIds WHERE uniqueId IN \(\?\)/);
  // No player table of its own: that read only the active players.
  assert.doesNotMatch(s, /hlstats_Players\b|hlstats_PlayersInactive/);
});

test("a match is an active or an inactive player, the active row wins", () => {
  const s = body("searchHits");
  assert.match(s, /LEFT JOIN hlstats_Players a ON a\.playerId = n\.playerId/);
  assert.match(s, /LEFT JOIN hlstats_PlayersInactive i ON i\.playerId = n\.playerId AND a\.playerId IS NULL/);
  assert.match(s, /const c = \(col: string\) => `COALESCE\(a\.\$\{col\}, i\.\$\{col\}\)`/);
});

test("only hidden, banned and hidden rankings stay out; the ranking only when chosen", () => {
  const s = body("searchHits");
  assert.match(s, /WHERE \$\{c\("hideranking"\)\} = 0\$\{game \? ` AND \$\{c\("game"\)\} = \?` : ""\}/);
  assert.match(s, /JOIN hlstats_Games g ON g\.code = \$\{c\("game"\)\} AND g\.hidden = '0'/);
  // No activity, last-seen, minimum-rounds or stats filter (a new player has 0 kills).
  assert.doesNotMatch(s, /last_event\s*[<>]|rounds|kills\)?\s*>|skill\)?\s*>/);
  assert.match(s, /ORDER BY skill DESC LIMIT \?`,\s*\[\.\.\.params, \.\.\.\(game \? \[game\] : \[\]\), SEARCH_LIMIT\]/);
});
