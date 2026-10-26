// A player with several running bans is one row with one badge per kind
// (VAC first), the newest date, and a red "!" as soon as a ban other than
// VAC runs. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { banKind, mainReason, markKind, mergeBans, type BanEntry } from "../src/lib/ban-merge.ts";

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
  assert.equal(markKind(rows[0].bans), "red");
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
