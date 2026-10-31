// Server forms list no template rankings (seeded rankings without servers),
// but a new ranking before its first server. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { serverRankingOptions } from "../src/lib/server-rankings.ts";

const games: [string, string][] = [
  ["css", "Counter-Strike: Source (css)"],
  ["tf", "Team Fortress 2 (tf)"],
  ["cstrike", "Counter-Strike 1.6 (cstrike)"],
  ["css_gg", "GunGame (css_gg)"],
];

test("templates are left out, a new ranking without servers stays", () => {
  assert.deepEqual(
    serverRankingOptions(games, new Set(["css", "tf"])).map(([c]) => c),
    ["css", "tf", "css_gg"],
  );
});

test("the order and the labels stay", () => {
  assert.deepEqual(serverRankingOptions(games, new Set(["tf", "css_gg"])), [games[1], games[3]]);
  assert.deepEqual(serverRankingOptions([...games, ["tf21", "TF 21 (tf21)"]], new Set(["css"])).map(([c]) => c), ["css", "css_gg", "tf21"]);
});

test("a server's current ranking is always listed", () => {
  assert.deepEqual(
    serverRankingOptions(games, new Set(["css"]), ["cstrike"]).map(([c]) => c),
    ["css", "cstrike", "css_gg"],
  );
  assert.deepEqual(
    serverRankingOptions(games, new Set(["css"]), [null, undefined, "", "unknown"]).map(([c]) => c),
    ["css", "css_gg"],
  );
});

test("without any ranking with servers every ranking stays", () => {
  assert.deepEqual(serverRankingOptions(games, new Set()), games);
  assert.deepEqual(serverRankingOptions(games, new Set(["gone"])), games);
});
