// A new ranking is created from its game alone; servers only go into a
// ranking of their own game. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { entities } from "../src/lib/admin-entities.ts";
import { sameBaseGame } from "../src/lib/games.ts";
import { resolveNewRanking, templateOptions } from "../src/lib/new-ranking.ts";

// Seeded rankings (code = game), an own css ranking, one without a game and
// one of a retired game.
const bases = new Map<string, string | null>([
  ["css", "css"],
  ["tf", "tf"],
  ["assault", "css"],
  ["custom", null],
  ["tfc", "tfc"],
]);
const order = ["assault", "css", "tf", "custom", "tfc"];
const make = (game: string, template = "", name = "") => resolveNewRanking({ game, template, name }, bases, order);

test("the game alone is enough: standard template and the game's name", () => {
  assert.deepEqual(make("css"), { game: "css", template: "css", name: "Counter-Strike: Source" });
  assert.deepEqual(make("TF"), { game: "tf", template: "tf", name: "Team Fortress 2" });
});

test("an own name and an own template of the same game are kept", () => {
  assert.deepEqual(make("css", "assault", "Assault"), { game: "css", template: "assault", name: "Assault" });
});

test("a template of another game is refused", () => {
  assert.deepEqual(make("css", "tf"), { field: "template" });
  assert.deepEqual(make("tf", "assault"), { field: "template" });
});

test("an unknown template or game is refused", () => {
  assert.deepEqual(make("css", "nope"), { field: "template" });
  assert.deepEqual(make("quake"), { field: "realgame" });
});

test("without a game the template's game is taken (API), with neither it is refused", () => {
  assert.deepEqual(make("", "assault"), { game: "css", template: "assault", name: "Counter-Strike: Source" });
  assert.deepEqual(make(""), { field: "realgame" });
  assert.deepEqual(make("", "custom"), { field: "realgame" });
});

test("without the realgame column the template decides alone", () => {
  assert.deepEqual(resolveNewRanking({ game: "", template: "custom", name: "X" }, bases, order, false), { game: "", template: "custom", name: "X" });
});

test("without a seeded ranking of the game the first ranking of it is the template", () => {
  const b = new Map<string, string | null>([["assault", "css"], ["gg", "css"]]);
  assert.deepEqual(resolveNewRanking({ game: "css", template: "", name: "" }, b, ["gg", "assault"]), {
    game: "css",
    template: "gg",
    name: "Counter-Strike: Source",
  });
  assert.equal((resolveNewRanking({ game: "cs2", template: "", name: "" }, b, ["gg"]) as { template: string }).template, "");
});

test("the template list shows rankings of a known, supported game with it", () => {
  const games: [string, string][] = order.map((c) => [c, `${c} (${c})`]);
  assert.deepEqual(templateOptions(games, bases), [
    ["assault", "assault (assault) – CS:S", "css"],
    ["css", "css (css) – CS:S", "css"],
    ["tf", "tf (tf) – TF2", "tf"],
  ]);
});

test("the new-ranking form starts with the game, the template is optional", () => {
  const f = entities.find((e) => e.key === "games")!.fields;
  assert.equal(f[0].name, "realgame");
  assert.equal(f[1].name, "template");
  assert.ok(!f[1].required);
});

test("a server only fits a ranking of the same game", () => {
  assert.ok(sameBaseGame("css", "css"));
  assert.ok(!sameBaseGame("css", "tf"));
  // A ranking without a game takes no server of a known game, and the
  // other way round.
  assert.ok(!sameBaseGame(null, "css"));
  assert.ok(!sameBaseGame("css", undefined));
  assert.ok(sameBaseGame(null, undefined));
});

test("every way into a ranking checks the game", () => {
  const ops = readFileSync("src/lib/admin-ops.ts", "utf8");
  assert.equal(ops.match(/!sameBaseGame\(/g)?.length, 3);
  assert.match(ops, /resolveNewRanking\(/);
  const card = readFileSync("src/app/admin/(panel)/rankings/[code]/servers-card.tsx", "utf8");
  assert.match(card, /servers\.filter\(\(s\) => s\.game !== code && fits\(s\.game\)\)/);
});
