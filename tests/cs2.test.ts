// Counter-Strike 2 on the website: its own engine tag, no shot columns, the
// neck zone and the two-level maps of the heatmap. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { baseGameOf, gameKind } from "../src/lib/games.ts";
import { levelParam, levelSplit, onLevel } from "../src/lib/map-levels.ts";
import { ZONES } from "../src/lib/zones.ts";

test("cs2 is a Source 2 game without shots", () => {
  const k = gameKind("cs2");
  assert.equal(k?.name, "Counter-Strike 2");
  assert.equal(k?.short, "CS2");
  assert.equal(k?.engine, "source2");
  assert.equal(k?.noShots, true);
  assert.equal(gameKind(" CS2 ")?.engine, "source2");
  assert.equal(baseGameOf("cs2", null), "cs2");
  assert.equal(baseGameOf("comp", "cs2"), "cs2");
});

test("the other games keep their shots", () => {
  for (const g of ["css", "csgo", "cstrike", "tf", "dods"]) assert.ok(!gameKind(g)?.noShots, g);
});

test("neck is a hit zone between head and chest", () => {
  assert.deepEqual(ZONES.slice(0, 3), ["head", "neck", "chest"]);
});

test("two-level maps only for Counter-Strike 2", () => {
  assert.equal(levelSplit("cs2", "de_nuke"), -495);
  assert.equal(levelSplit("cs2", "DE_VERTIGO"), 11700);
  assert.equal(levelSplit("cs2", "de_dust2"), null);
  assert.equal(levelSplit("csgo", "de_nuke"), null);
  assert.equal(levelSplit(null, "de_nuke"), null);
});

test("levels split at the height; unknown heights are on neither", () => {
  assert.ok(onLevel(-600, -495, "lower"));
  assert.ok(onLevel(-495, -495, "lower"));
  assert.ok(!onLevel(-495, -495, "upper"));
  assert.ok(onLevel(-300, -495, "upper"));
  assert.ok(!onLevel(null, -495, "upper"));
  assert.ok(!onLevel(null, -495, "lower"));
  assert.ok(!onLevel(Number.NaN, -495, "lower"));
});

test("only upper and lower are level parameters", () => {
  assert.equal(levelParam("upper"), "upper");
  assert.equal(levelParam("lower"), "lower");
  for (const v of [undefined, "", "UPPER", "1", "upper "]) assert.equal(levelParam(v), null, String(v));
});
