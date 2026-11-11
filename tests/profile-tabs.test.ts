// Tabs of the player profile (src/lib/profile-tabs.ts and the profile page):
// the overview without maps, weapons, opponents and kills, each of those on
// its own tab. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { profileTab, profileTabHref } from "../src/lib/profile-tabs";

test("only known tabs, anything else is the overview", () => {
  assert.equal(profileTab("weapons"), "weapons");
  assert.equal(profileTab(["kills", "maps"]), "kills");
  assert.equal(profileTab(undefined), "");
  assert.equal(profileTab(""), "");
  assert.equal(profileTab("info"), "");
  assert.equal(profileTab("WEAPONS"), "");
  assert.equal(profileTab("constructor"), "");
});

test("tab links", () => {
  assert.equal(profileTabHref("/css/players/7", ""), "/css/players/7");
  assert.equal(profileTabHref("/css/players/7", "opponents"), "/css/players/7?tab=opponents");
});

test("the overview does not read the opponents and kill statistics", () => {
  const s = readFileSync("src/app/(site)/[game]/players/[id]/page.tsx", "utf8");
  assert.match(s, /tab === "opponents" \? getOpponents\(game, id, "victims"\)/);
  assert.match(s, /tab === "opponents" \? getOpponents\(game, id, "killers"\)/);
  assert.match(s, /tab === "kills" \? getPlayerKillStats\(game, id\)/);
  for (const part of ["maps", "weapons", "opponents", "kills"]) assert.match(s, new RegExp(`\\{tab === "${part}" \\?`), part);
});
