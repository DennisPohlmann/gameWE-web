// Admin > Players lists the inactive players too (hlstats_PlayersInactive),
// so the list and the overview agree; "Banned" says what it covers. Run
// with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { entities } from "../src/lib/admin-entities.ts";

const data = readFileSync("src/lib/admin-data.ts", "utf8");

test("players read both tables, each player once", () => {
  const e = entities.find((x) => x.key === "players")!;
  assert.equal(e.alsoTable, "hlstats_PlayersInactive");
  assert.ok(e.alsoColumns!.includes(e.pk));
  assert.match(data, /WHERE NOT EXISTS \(SELECT 1 FROM \$\{e\.table\} m WHERE m\.\$\{e\.pk\} = a\.\$\{e\.pk\}\)/);
  // List, count, the count of the list by name and the row of the edit form.
  assert.equal(data.match(/FROM \$\{source\(e\)\} t/g)?.length, 5);
});

test("a page without state, also a search, reads the best rows of each table", () => {
  assert.match(data, /const top = !!e\.alsoColumns && !status && \(!sortCol/);
  // A search needs the player name: each table joins it itself.
  assert.match(data, /topOfSource\(e, where, order, opts\.q \? \(e\.join \?\? ""\) : ""\)/);
  // Same condition as the full union: a player in both tables counts once.
  assert.match(data, /NOT EXISTS \(SELECT 1 FROM \$\{e\.table\} m WHERE m\.\$\{e\.pk\} = t\.\$\{e\.pk\}\)/);
});

test("a save writes both tables, a missing right on the inactive one is named", () => {
  assert.match(data, /await adminExec\(`UPDATE \$\{e\.alsoTable\} SET \$\{set\} WHERE \$\{e\.pk\} = \?`/);
  assert.match(data, /if \(isDenied\(err\)\) throw new InputError\("inactive"\);/);
});

test("the state filters, Banned named by its sources", () => {
  const e = entities.find((x) => x.key === "players")!;
  assert.deepEqual(e.statusFilter!.map((f) => f.value), ["visible", "hidden", "banned", "inactive"]);
  assert.match(e.statusFilter![2].label.en, /SourceBans, VAC block/);
});
