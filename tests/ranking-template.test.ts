// A ranking an admin creates is never a template, also before its first
// server (it showed as "Template" and could not be chosen for a server);
// only a seeded ranking without servers is one. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { isSeededRanking, isTemplateRanking } from "../src/lib/ranking-template.ts";
import { serverRankingOptions } from "../src/lib/server-rankings.ts";

test("a new ranking without servers is not a template", () => {
  assert.equal(isTemplateRanking("tf21", 0), false);
  assert.equal(isTemplateRanking("css_gg", 0), false);
  assert.equal(isTemplateRanking("assault", 0), false);
});

test("a seeded ranking without servers is a template, with servers it is not", () => {
  for (const c of ["css", "tf", "csgo", "cstrike", "hl2ctf", "dinodday", " CSS "]) assert.equal(isTemplateRanking(c, 0), true, c);
  assert.equal(isTemplateRanking("css", 2), false);
  assert.equal(isSeededRanking("tf21"), false);
});

test("the server form offers the new ranking, not the templates", () => {
  const games: [string, string][] = [
    ["css", "Counter-Strike: Source (css)"],
    ["tf", "Team Fortress 2 (tf)"],
    ["tf21", "tf21 (tf21)"],
  ];
  assert.deepEqual(
    serverRankingOptions(games, new Set(["css"])).map(([c]) => c),
    ["css", "tf21"],
  );
});
