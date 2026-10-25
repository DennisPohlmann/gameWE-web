// The Source mods with collector reference data (Zombie Panic! Source,
// Fortress Forever, CSPromod, Fistful of Frags, No More Room in Hell): known
// base games with name, short tag and engine. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { baseGameOf, gameKind } from "../src/lib/games.ts";

test("the Source mods are known base games", () => {
  for (const [code, short] of [["zps", "ZPS"], ["ff", "FF"], ["csp", "CSP"], ["fof", "FoF"], ["nmrih", "NMRiH"]]) {
    const k = gameKind(code);
    assert.equal(k?.short, short, code);
    assert.equal(k?.engine, "source", code);
    assert.ok(!k?.noShots, code);
    assert.equal(baseGameOf(code, null), code);
    assert.equal(baseGameOf(code + "_fun", code), code);
  }
});

test("only No More Room in Hell is limited (no weapons and actions yet)", () => {
  assert.equal(gameKind("nmrih")?.limited, true);
  for (const g of ["zps", "ff", "csp", "fof"]) assert.ok(!gameKind(g)?.limited, g);
});
