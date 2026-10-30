// The Source games with collector reference data (Zombie Panic! Source,
// Fistful of Frags, No More Room in Hell, Left 4 Dead 1 and 2): known base
// games with name, short tag and engine; the retired games (TFC, NS,
// Insurgency, Fortress Forever, CSPromod) stay known for existing rankings
// but are not offered. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { gameIconSrc } from "../src/lib/game-icons.ts";
import { baseGameOf, gameKind, RETIRED_GAMES, sameBaseGame, SUPPORTED_GAMES } from "../src/lib/games.ts";
import { entities } from "../src/lib/admin-entities.ts";

test("the Source mods are known base games", () => {
  for (const [code, short] of [["zps", "ZPS"], ["fof", "FoF"], ["nmrih", "NMRiH"], ["l4d", "L4D"], ["l4d2", "L4D2"]]) {
    const k = gameKind(code);
    assert.equal(k?.short, short, code);
    assert.equal(k?.engine, "source", code);
    assert.ok(!k?.noShots, code);
    assert.equal(baseGameOf(code, null), code);
    assert.equal(baseGameOf(code + "_fun", code), code);
  }
});

test("only No More Room in Hell and Insurgency are limited (no weapons and actions yet)", () => {
  for (const g of ["nmrih", "insurgency"]) assert.equal(gameKind(g)?.limited, true, g);
  for (const g of ["zps", "fof", "l4d", "l4d2"]) assert.ok(!gameKind(g)?.limited, g);
});

test("the retired games stay known for existing rankings, but are not offered", () => {
  assert.deepEqual([...RETIRED_GAMES].sort(), ["csp", "ff", "insurgency", "ns", "tfc"]);
  for (const g of RETIRED_GAMES) {
    assert.ok(!SUPPORTED_GAMES.includes(g), g);
    assert.equal(baseGameOf(g, null), g);
    assert.equal(baseGameOf(g + "_x", g), g);
    assert.equal(gameIconSrc(g), null, g);
  }
  // A TFC server is still kept out of a TF2 ranking.
  assert.equal(gameKind("tfc")?.engine, "goldsrc");
  assert.ok(!sameBaseGame(baseGameOf("tfc", "tfc"), baseGameOf("tf", "tf")));
  for (const g of ["css", "csgo", "czero", "cs2"]) assert.ok(SUPPORTED_GAMES.includes(g), g);
  const realgame = entities.find((e) => e.key === "games")?.fields.find((f) => f.name === "realgame");
  assert.deepEqual(realgame?.keepOnly, RETIRED_GAMES);
});
