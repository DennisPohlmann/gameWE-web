// Ranking reset modes: the form values the server action accepts and the
// names of stored jobs. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { RESET_MODES, jobModeName, resetMode } from "../src/lib/reset-modes.ts";

test("the three modes of the collector, player statistics first", () => {
  assert.deepEqual([...RESET_MODES], ["player-stats", "all-stats", "all"]);
  for (const m of RESET_MODES) assert.equal(resetMode(m), m);
});

test("anything else from the form is refused", () => {
  for (const v of [null, undefined, "", "stats", "ALL", "all ", "players", "all'; DROP TABLE x", 1]) assert.equal(resetMode(v), null);
});

test("stored jobs of the old mode stats show as player statistics", () => {
  assert.equal(jobModeName("stats"), "player-stats");
  assert.equal(jobModeName("all-stats"), "all-stats");
  assert.equal(jobModeName("all"), "all");
  assert.equal(jobModeName("bogus"), null);
});
