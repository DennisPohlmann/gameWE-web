// A player with several running bans is one row with one badge per kind
// (VAC first), the newest date, and a "!" that is yellow for VAC, red for
// the others and split when both run. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { banKind, banSlots, mainReason, markKind, mergeBans, steamBanEntry, type BanEntry } from "../src/lib/ban-merge.ts";

const ban = (kind: BanEntry["kind"], at: number | null, reason = ""): BanEntry => ({ kind, at, dateText: "", reason, length: "", until: null });

test("VAC and SourceBans of one player: one row, VAC badge first, newest date", () => {
  const rows = mergeBans(
    [
      { player: { id: 1 }, ban: ban("sourcebans", 200, "Cheating") },
      { player: { id: 2 }, ban: ban("vac", 50, "1× VAC") },
      { player: { id: 1 }, ban: ban("vac", 300, "2× VAC") },
    ],
    (p) => p.id,
  );
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0].bans.map((b) => b.kind), ["vac", "sourcebans"]);
  assert.equal(rows[0].at, 300);
  assert.equal(markKind(rows[0].bans), "both");
  assert.equal(mainReason(rows[0].bans), "Cheating");
  assert.equal(markKind(rows[1].bans), "vac");
  assert.equal(mainReason(rows[1].bans), "1× VAC");
});

test("the same kind twice (record and SourceBans list): the newest stays", () => {
  const rows = mergeBans(
    [
      { player: 7, ban: ban("sourcebans", 100, "old text") },
      { player: 7, ban: ban("sourcebans", 150, "record") },
      { player: 7, ban: ban("sourcebans", null, "list without date") },
    ],
    (p) => p,
  );
  assert.equal(rows[0].bans.length, 1);
  assert.equal(rows[0].bans[0].reason, "record");
});

test("unknown ban types count as server bans", () => {
  assert.equal(banKind("vac"), "vac");
  assert.equal(banKind("kick"), "engine");
  assert.equal(banKind(null), "engine");
  assert.equal(markKind([ban("engine", null)]), "red");
});

test("VAC and SourceBans badges always side by side, the missing one empty (grey)", () => {
  const always: BanEntry["kind"][] = ["vac", "sourcebans"];
  assert.deepEqual(
    banSlots([ban("sourcebans", 1)], always).map((x) => [x.kind, !!x.ban]),
    [["vac", false], ["sourcebans", true]],
  );
  assert.deepEqual(
    banSlots([ban("vac", 1)], always).map((x) => [x.kind, !!x.ban]),
    [["vac", true], ["sourcebans", false]],
  );
  // A server ban gets its own badge only when it runs; an unchecked source none.
  assert.deepEqual(
    banSlots([ban("engine", 1)], ["vac"]).map((x) => [x.kind, !!x.ban]),
    [["vac", false], ["engine", true]],
  );
  assert.equal(markKind([ban("sourcebans", 1)]), "red");
});

test("Steam's ban list: VAC and game bans both make the VAC badge (bans page and profile alike)", () => {
  assert.equal(steamBanEntry({ vac: 0, game: 0, days: 0 }, 1000000), null);
  assert.deepEqual(steamBanEntry({ vac: 0, game: 1, days: 2 }, 1000000), { kind: "vac", at: 1000000 - 2 * 86400, dateText: "", reason: "1× Game Ban", length: "", until: null });
  assert.equal(steamBanEntry({ vac: 2, game: 1, days: 0 }, 5)?.reason, "2× VAC");
  // A game ban and a SourceBans ban: split "!" and both badges, as on the bans page.
  const both = [steamBanEntry({ vac: 0, game: 1, days: 0 }, 5)!, ban("sourcebans", 1)];
  assert.equal(markKind(both), "both");
  assert.deepEqual(banSlots(mergeBans(both.map((b) => ({ player: 0, ban: b })), () => 0)[0].bans, ["vac", "sourcebans"]).map((x) => [x.kind, !!x.ban]), [["vac", true], ["sourcebans", true]]);
});
