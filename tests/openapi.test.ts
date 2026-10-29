// The OpenAPI document of the public API (/api/openapi.json): examples use
// the site's first ranking, every example has exactly the fields of its
// schema, and points carry the website's names. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { EXAMPLE_GAME, endpoints, gameCodeOk, openApiDocument } from "../src/lib/openapi.ts";

type Schema = { $ref?: string; allOf?: Schema[]; anyOf?: Schema[]; type?: string; properties?: Record<string, Schema>; items?: Schema; deprecated?: boolean; example?: unknown };
type Doc = {
  paths: Record<string, { get: { parameters?: { name: string; in: string; example?: unknown }[]; responses: Record<string, { content?: Record<string, { schema: Schema; example: unknown }> }> } }>;
  components: { schemas: Record<string, Schema> };
};

const doc = openApiDocument("1.2.3", "css1") as Doc;

// Field names of an object schema ($ref, allOf and nullable resolved).
function fields(s: Schema): string[] {
  if (s.$ref) return fields(doc.components.schemas[s.$ref.replace("#/components/schemas/", "")]);
  if (s.allOf) return s.allOf.flatMap(fields);
  if (s.anyOf) return fields(s.anyOf.find((x) => x.type !== "null") ?? {});
  return Object.keys(s.properties ?? {});
}

function itemSchema(s: Schema): Schema {
  if (s.$ref) return itemSchema(doc.components.schemas[s.$ref.replace("#/components/schemas/", "")]);
  return s;
}

test("the examples use the first ranking instead of css", () => {
  const text = JSON.stringify(doc);
  assert.ok(!text.includes(EXAMPLE_GAME));
  assert.ok(!text.includes("/rankings/css/"));
  assert.ok(text.includes("/rankings/css1/players"));
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const p of item.get.parameters ?? []) if (p.name === "game") assert.equal(p.example, "css1", path);
  }
  const ranking = doc.paths["/rankings/{game}"].get.responses["200"].content?.["application/json"].example as { game: string; baseGame: string };
  assert.equal(ranking.game, "css1");
  // The base game stays the game (Counter-Strike: Source), not the ranking.
  assert.equal(ranking.baseGame, "css");
});

test("a missing or invalid ranking code falls back to css", () => {
  for (const bad of ["", "x".repeat(33), 'a"b', "../x", "a b"]) {
    assert.equal(gameCodeOk(bad), false, bad);
    const text = JSON.stringify(openApiDocument("1", bad));
    assert.ok(text.includes("/rankings/css/players"), bad);
    assert.ok(!text.includes(EXAMPLE_GAME), bad);
  }
  assert.ok(JSON.stringify(openApiDocument("1")).includes("/rankings/css/players"));
});

test("every example has exactly the fields of its schema", () => {
  for (const e of endpoints) {
    if (e.image) continue;
    const response = doc.paths[e.path].get.responses["200"].content?.["application/json"];
    assert.ok(response, e.path);
    const examples: unknown[] = [];
    const schemas: Schema[] = [];
    if (e.list) {
      const page = response.example as { data: unknown[] };
      examples.push(...page.data);
      schemas.push(...page.data.map(() => doc.components.schemas[e.list!.item]));
    } else if (Array.isArray(response.example)) {
      const items = itemSchema(response.schema).items ?? {};
      examples.push(...response.example);
      schemas.push(...response.example.map(() => items));
    } else {
      examples.push(response.example);
      schemas.push(response.schema);
    }
    assert.ok(examples.length > 0, `${e.path}: no example`);
    examples.forEach((x, i) => {
      assert.deepEqual(Object.keys(x as object).sort(), [...new Set(fields(schemas[i]))].sort(), e.path);
    });
  }
});

test("points carry the website's names; skill stays as a deprecated alias", () => {
  const s = doc.components.schemas;
  for (const [schema, now, old] of [
    ["RankingRow", "points", "skill"],
    ["LivePlayer", "points", "skill"],
    ["LivePlayer", "pointsChange", "skillChange"],
    ["Place", "totalPoints", "skill"],
    ["Place", "avgPoints", "avgSkill"],
    ["Clan", "avgPoints", "avgSkill"],
    ["RankPlayer", "points", "skill"],
    ["PlayerDay", "points", "skill"],
  ] as const) {
    assert.ok(s[schema].properties?.[now], `${schema}.${now}`);
    assert.ok(!s[schema].properties?.[now].deprecated, `${schema}.${now}`);
    assert.equal(s[schema].properties?.[old].deprecated, true, `${schema}.${old}`);
  }
  // The ranking numbers its rows (position) and keeps the place in the whole ranking (rank).
  assert.ok(s.RankingRow.properties?.position);
  assert.ok(s.RankingRow.properties?.rank);
});

test("sorting by points is documented wherever skill sorts", () => {
  for (const e of endpoints) {
    const sorts = e.list?.sorts ?? [];
    if (sorts.includes("skill")) assert.ok(sorts.includes("points"), e.path);
  }
});

test("every path of the index is documented and unknown paths are no endpoint", () => {
  const paths = new Set(Object.keys(doc.paths));
  for (const e of endpoints) assert.ok(paths.has(e.path), e.path);
  assert.ok(![...paths].some((p) => p.includes("...")));
});

test("banners answer PNG and take a style", () => {
  const images = endpoints.filter((e) => e.image);
  assert.deepEqual(images.map((e) => e.path).sort(), ["/players/{id}/banner", "/rankings/{game}/servers/{id}/banner", "/voice/teamspeak/banner"]);
  for (const e of images) {
    const ok = doc.paths[e.path].get.responses["200"].content ?? {};
    assert.deepEqual(Object.keys(ok), ["image/png"], e.path);
    assert.ok((doc.paths[e.path].get.parameters ?? []).some((p) => p.name === "style" && p.in === "query"), e.path);
    // Errors stay JSON.
    assert.ok(doc.paths[e.path].get.responses["404"].content?.["application/json"], e.path);
  }
});

test("every read page of the website has an endpoint", () => {
  const paths = new Set(endpoints.map((e) => e.path));
  for (const p of [
    "/stats",
    "/activity",
    "/voice",
    "/voice/teamspeak",
    "/search/players",
    "/search/clans",
    "/points",
    "/rankings/{game}/activity",
    "/rankings/{game}/load",
    "/rankings/{game}/map/live",
    "/rankings/{game}/map/players",
    "/rankings/{game}/events",
    "/rankings/{game}/events/stats",
    "/rankings/{game}/hall-of-fame",
    "/rankings/{game}/hall-of-fame/stars",
    "/rankings/{game}/misc",
    "/rankings/{game}/maps/{id}/heatmap",
    "/rankings/{game}/clans/{id}/map",
    "/rankings/{game}/clans/{id}/history",
    "/rankings/{game}/clans/{id}/radar",
    "/rankings/{game}/clans/{id}/weapons",
    "/rankings/{game}/clans/{id}/maps",
    "/rankings/{game}/clans/{id}/events",
    "/players/{id}/events",
    "/players/{id}/radar",
  ]) {
    assert.ok(paths.has(p), p);
  }
  // Inactive players, clans and members are a view of their lists.
  for (const p of ["/rankings/{game}/players", "/rankings/{game}/clans", "/rankings/{game}/clans/{id}/members"]) {
    assert.ok((doc.paths[p].get.parameters ?? []).some((x) => x.name === "view"), p);
  }
});

test("no endpoint documents chat, addresses or Steam IDs", () => {
  const text = JSON.stringify(doc.components.schemas).toLowerCase();
  for (const word of ['"ip"', '"ipaddress"', '"uniqueid"', '"steamid"', '"chat"', '"message"']) assert.ok(!text.includes(word), word);
  for (const e of endpoints) assert.ok(!/chat|ips|bans/.test(e.path), e.path);
});

test("the TeamSpeak password is documented as depending on the admin setting", () => {
  for (const p of ["/voice", "/voice/teamspeak"]) {
    const text = JSON.stringify(doc.paths[p].get.responses["200"]);
    assert.ok(text.includes("passwordProtected"), p);
    assert.ok(text.includes("only while the admin allows showing it"), p);
  }
});
