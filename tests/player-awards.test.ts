// The player awards read a column of hlstats_Players_History; the HLstatsX:CE
// code teamkills counts the day's team kills. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PLAYER_AWARDS } from "../src/lib/player-awards.ts";

// Columns of hlstats_Players_History (collector schema) a player award may read.
const HISTORY = new Set(["kills", "deaths", "suicides", "headshots", "damage", "skill_change", "connection_time", "kill_streak", "team_kills"]);

test("every player award reads a history column", () => {
  for (const [code, col] of Object.entries(PLAYER_AWARDS)) assert.ok(HISTORY.has(col), `${code}: ${col}`);
});

test("the HLstatsX:CE award teamkills counts the day's team kills", () => {
  assert.equal(PLAYER_AWARDS.teamkills, "team_kills");
  // CE's mostkills and suicide are not added: most_kills and most_suicides
  // cover them; headshot and mvp are actions, not history columns
  for (const code of ["mostkills", "suicide", "headshot", "mvp"]) assert.equal(PLAYER_AWARDS[code], undefined, code);
});
