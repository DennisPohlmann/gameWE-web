// Server forms list no template rankings (rankings without servers). Run
// with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { serverRankingOptions } from "../src/lib/server-rankings.ts";

const games: [string, string][] = [
  ["css", "Counter-Strike: Source (css)"],
  ["tf", "Team Fortress 2 (tf)"],
  ["cstrike", "Counter-Strike 1.6 (cstrike)"],
  ["css_gg", "GunGame (css_gg)"],
];

test("templates are left out", () => {
  assert.deepEqual(
    serverRankingOptions(games, new Set(["css", "tf"])).map(([c]) => c),
    ["css", "tf"],
  );
});

test("the order and the labels stay", () => {
  assert.deepEqual(serverRankingOptions(games, new Set(["tf", "css_gg"])), [games[1], games[3]]);
});

test("a server's current ranking is always listed", () => {
  assert.deepEqual(
    serverRankingOptions(games, new Set(["css"]), ["cstrike"]).map(([c]) => c),
    ["css", "cstrike"],
  );
  assert.deepEqual(
    serverRankingOptions(games, new Set(["css"]), [null, undefined, "", "unknown"]).map(([c]) => c),
    ["css"],
  );
});

test("without any ranking with servers every ranking stays", () => {
  assert.deepEqual(serverRankingOptions(games, new Set()), games);
  assert.deepEqual(serverRankingOptions(games, new Set(["gone"])), games);
});
