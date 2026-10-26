// "Add server" on a ranking's page: only an existing ranking is preset, and
// the redirect is built from it. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { newServerHref, presetRanking, rankingServersHref } from "../src/lib/ranking-preset.ts";

const codes = ["css", "cs2_dm", "dods"];

test("an existing ranking is preset", () => {
  assert.equal(presetRanking("css", codes), "css");
  assert.equal(presetRanking("cs2_dm", codes), "cs2_dm");
});

test("anything else is ignored", () => {
  for (const v of [null, undefined, 1, "", "CSS", " css", "css ", "tf", "css&x=1", "../users", "//evil.example", "x".repeat(65), ["css"]]) {
    assert.equal(presetRanking(v, codes), null, String(v));
  }
  assert.equal(presetRanking("css", []), null);
});

test("the form link carries the ranking", () => {
  assert.equal(newServerHref("css"), "/admin/servers/new?game=css");
  assert.equal(newServerHref("a b&c"), "/admin/servers/new?game=a+b%26c");
});

test("the save returns to the ranking's servers", () => {
  assert.equal(rankingServersHref("css", { saved: "server" }), "/admin/rankings/css?saved=server#servers");
  assert.equal(rankingServersHref("cs2_dm"), "/admin/rankings/cs2_dm#servers");
  // Encoded, so it stays a path below /admin/rankings.
  assert.equal(rankingServersHref("a/../b?c#d"), "/admin/rankings/a%2F..%2Fb%3Fc%23d#servers");
});
