// The Source games with collector reference data (Zombie Panic! Source,
// Fortress Forever, CSPromod, Fistful of Frags, No More Room in Hell, Left 4
// Dead 1 and 2): known base games with name, short tag and engine. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { baseGameOf, gameKind } from "../src/lib/games.ts";

test("the Source mods are known base games", () => {
  for (const [code, short] of [["zps", "ZPS"], ["ff", "FF"], ["csp", "CSP"], ["fof", "FoF"], ["nmrih", "NMRiH"], ["l4d", "L4D"], ["l4d2", "L4D2"]]) {
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
  for (const g of ["zps", "ff", "csp", "fof", "l4d", "l4d2"]) assert.ok(!gameKind(g)?.limited, g);
});
