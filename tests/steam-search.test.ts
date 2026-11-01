// Admin IP and chat search by a Steam ID in any form. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { steamSearchIds } from "../src/lib/steam-id.ts";

const want = ["1:4242", "STEAM_0:1:4242", "STEAM_1:1:4242", "[U:1:8485]", "U:1:8485", "76561197960274213"];

test("every form gives the same stored forms", () => {
  for (const q of ["STEAM_0:1:4242", "STEAM_1:1:4242", "steam_0:1:4242", "1:4242", "[U:1:8485]", "U:1:8485", "[u:1:8485]", "76561197960274213", " 76561197960274213 "]) {
    assert.deepEqual(steamSearchIds(q), want, q);
  }
});

test("other text is no Steam ID", () => {
  for (const q of ["", "gg", "84.12.", "Player 1", "STEAM_0:2:1", "123", "U:1:0"]) assert.equal(steamSearchIds(q), null, q);
});
