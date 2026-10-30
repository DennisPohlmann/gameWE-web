// Start page: the players online count everyone on the servers, bots
// included (the heading "Rankings (N players online)" and the "playing now"
// of the general statistics). Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { playerCount, sumCounts } from "../src/lib/player-count.ts";

const home = readFileSync("src/app/(site)/page.tsx", "utf8");

test("the heading counts real players and bots", () => {
  assert.match(home, /fill\(t\.rankingsCount, \{ n: fmtNum\(online\.real \+ online\.bots, lang\) \}\)/);
  // 2 players and 30 bots on one server, 32 bots on the other: 64.
  const all = sumCounts([playerCount(32, 30, 48), playerCount(32, 32, 48)]);
  assert.equal(all.real + all.bots, 64);
});
