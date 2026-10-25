// Sort keys of the player and place rankings. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { PLACE_SORT_DEFAULT, placeSorts, rankingSorts, sortParam } from "../src/lib/sorts.ts";

test("country and city rankings sort by total points by default", () => {
  assert.equal(PLACE_SORT_DEFAULT, "skill");
  assert.equal(placeSorts[PLACE_SORT_DEFAULT], "skill");
  assert.equal(sortParam(placeSorts, "", PLACE_SORT_DEFAULT), "skill");
});

test("each place column sorts by its own numeric value", () => {
  assert.deepEqual(placeSorts, {
    players: "players",
    skill: "skill",
    avg: "avgSkill",
    kills: "kills",
    deaths: "deaths",
    kpd: "kills * 1.0 / GREATEST(deaths, 1)",
    hpk: "headshots * 1.0 / GREATEST(kills, 1)",
    time: "connection_time",
    name: "name",
  });
});

test("known keys are kept, unknown and inherited keys fall back", () => {
  for (const k of Object.keys(placeSorts)) assert.equal(sortParam(placeSorts, k, PLACE_SORT_DEFAULT), k);
  for (const k of ["junk", "constructor", "toString", "__proto__", "hasOwnProperty", "SKILL"]) {
    assert.equal(sortParam(placeSorts, k, PLACE_SORT_DEFAULT), "skill");
    assert.equal(sortParam(rankingSorts, k, "skill"), "skill");
  }
  assert.equal(sortParam(rankingSorts, "acc", "skill"), "acc");
  assert.equal(sortParam(rankingSorts, "", "new"), "new");
});

test("the API lists countries and cities by total points by default", async () => {
  const { endpoints } = await import("../src/lib/openapi.ts");
  for (const path of ["/rankings/{game}/countries", "/rankings/{game}/cities"]) {
    const e = endpoints.find((x) => x.path === path);
    assert.equal(e?.list?.sort, "skill", path);
    assert.deepEqual(e?.list?.sorts, Object.keys(placeSorts), path);
  }
});
