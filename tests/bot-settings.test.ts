// Bot settings per ranking: the keys and how a stored value is read (as the
// collector reads it). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { botSettingKeys, botSettingOn } from "../src/lib/bot-settings.ts";

test("keys of a ranking", () => {
  assert.deepEqual(botSettingKeys("css"), { ranked: "gamewe_rank_bots_css", points: "gamewe_bot_points_css", kills: "gamewe_bot_kills_css" });
});

test("missing means on, 0/false/no/off/empty mean off", () => {
  assert.equal(botSettingOn(undefined), true);
  assert.equal(botSettingOn(null), true);
  for (const v of ["1", "true", " yes ", "on", "ON"]) assert.equal(botSettingOn(v), true, v);
  for (const v of ["0", "false", "no", "off", "", " Off "]) assert.equal(botSettingOn(v), false, v);
});
