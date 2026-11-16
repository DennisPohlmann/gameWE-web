// Which positions the heatmap takes: the frags (with headshots) must win
// over the locations, which always have a few rows more. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fragsWin } from "../src/lib/heat-source.ts";

test("frags win over a few more locations (headshot dots stay)", () => {
  assert.equal(fragsWin(1000, 1000, 3000), true);
  assert.equal(fragsWin(1000, 1012, 3000), true); // team kills, suicides
  assert.equal(fragsWin(2900, 40000, 3000), true); // the newest 3000 are frags anyway
});

test("locations win where the frags have few or no positions", () => {
  assert.equal(fragsWin(0, 50, 3000), false);
  assert.equal(fragsWin(100, 5000, 3000), false); // older CS:S kills
});
