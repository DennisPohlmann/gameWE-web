// Counter-Strike: Condition Zero on the website: a GoldSrc game of its own
// with the CT/T win ratio like the other Counter-Strike games. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { baseGameOf, gameKind, sameBaseGame } from "../src/lib/games.ts";
import { SIDE_GAMES } from "../src/lib/shares.ts";

test("czero is a GoldSrc game with shots", () => {
  const k = gameKind("czero");
  assert.equal(k?.name, "Counter-Strike: Condition Zero");
  assert.equal(k?.short, "CS:CZ");
  assert.equal(k?.engine, "goldsrc");
  assert.ok(!k?.noShots && !k?.limited);
  assert.equal(gameKind(" CZERO ")?.engine, "goldsrc");
  assert.equal(baseGameOf("czero", null), "czero");
  assert.equal(baseGameOf("cz_public", "czero"), "czero");
});

test("czero and cstrike are different games", () => {
  assert.equal(sameBaseGame("czero", "cstrike"), false);
  assert.equal(sameBaseGame("czero", "czero"), true);
});

test("every Counter-Strike game shows the CT/T win ratio", () => {
  for (const g of ["css", "csgo", "cs2", "cstrike", "czero"]) assert.ok(SIDE_GAMES.has(g), g);
  for (const g of ["tf", "dods", "hl2mp"]) assert.ok(!SIDE_GAMES.has(g), g);
});
