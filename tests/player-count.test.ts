// Players online split into real players and bots ("1 (31 BOT) / 48").
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { playerCount, sumCounts } from "../src/lib/player-count.ts";

test("no bots: all players are real", () => {
  assert.deepEqual(playerCount(5, 0, 24), { real: 5, bots: 0, max: 24 });
  assert.deepEqual(playerCount(0, null, 24), { real: 0, bots: 0, max: 24 });
});

test("bots are taken out of act_players", () => {
  assert.deepEqual(playerCount(32, 31, 48), { real: 1, bots: 31, max: 48 });
  assert.deepEqual(playerCount(31, 31, 48), { real: 0, bots: 31, max: 48 });
});

test("real players never go below 0", () => {
  // More live bot rows than act_players (e.g. during a map change).
  assert.deepEqual(playerCount(10, 14, 48), { real: 0, bots: 10, max: 48 });
  assert.deepEqual(playerCount(-3, 2, 0), { real: 0, bots: 0, max: 0 });
});

test("database strings and missing values", () => {
  assert.deepEqual(playerCount("12", "4", "24"), { real: 8, bots: 4, max: 24 });
  assert.deepEqual(playerCount(undefined, undefined, undefined), { real: 0, bots: 0, max: 0 });
  assert.deepEqual(playerCount("x", 1, 16), { real: 0, bots: 0, max: 16 });
});

test("totals sum the servers, each capped on its own", () => {
  const total = sumCounts([playerCount(32, 31, 48), playerCount(11, 9, 32), playerCount(3, 5, 16), playerCount(0, 0, 64)]);
  assert.deepEqual(total, { real: 3, bots: 43, max: 160 });
  assert.deepEqual(sumCounts([]), { real: 0, bots: 0, max: 0 });
});
