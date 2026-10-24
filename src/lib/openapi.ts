import { basePath } from "./base-path";

// OpenAPI 3.1 description of the public API (/api/v1/...), shown on /api by
// Scalar and served as /api/openapi.json. One entry per route under
// src/app/api/v1; scripts/vendor.mjs fails the build when a route has no
// entry here. The examples are made-up data on example.org.

type Schema = Record<string, unknown>;
type Param = { name: string; in: "path" | "query"; description: string; schema: Schema; required?: boolean; example?: unknown };
type Endpoint = {
  path: string;
  operationId: string;
  tag: "Rankings" | "Servers" | "Players";
  summary: string;
  description: string;
  params?: Param[];
  schema: Schema;
  example: unknown;
  notFound?: string;
};

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const int = (description: string, extra: Schema = {}): Schema => ({ type: "integer", description, ...extra });
const str = (description: string, extra: Schema = {}): Schema => ({ type: "string", description, ...extra });
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: "null" }] });
const obj = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties) });
const unix = (description: string) => int(`${description} (Unix time, seconds)`);

const gameParam: Param = { name: "game", in: "path", required: true, description: "Code of the ranking, as in /api/v1/rankings", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: "css" };
const idParam = (what: string): Param => ({ name: "id", in: "path", required: true, description: `ID of the ${what}`, schema: int("", { minimum: 0, maximum: 9999999999 }), example: 42 });

const schemas: Record<string, Schema> = {
  Error: obj({ error: str("not found, rate limit or internal error", { examples: ["not found"] }) }),
  Country: obj({ code: str("ISO 3166-1 alpha-2 code"), name: str("Country name") }),
  Server: obj({
    id: int("Server ID"),
    name: str("Server name"),
    address: str("Public address with port"),
    map: nullable(str("Current map")),
    players: int("Players online"),
    maxPlayers: int("Slots"),
    mapStarted: nullable(unix("Start of the current map")),
    kills: int("Kills on this server"),
    headshots: int("Headshots on this server"),
    rounds: int("Rounds played"),
    country: nullable(str("ISO code of the server's country")),
  }),
  LivePlayer: obj({
    id: nullable(int("Player ID, null for bots")),
    name: str("Name in game"),
    bot: { type: "boolean", description: "Bot" },
    team: nullable(str("Team")),
    kills: int("Kills this map"),
    deaths: int("Deaths this map"),
    headshots: int("Headshots this map"),
    skill: int("Points"),
    skillChange: int("Points won or lost this map"),
    rank: int("Position in the ranking"),
    connectedSince: nullable(unix("Connected since")),
    dead: { type: "boolean", description: "Dead right now" },
    country: nullable(ref("Country")),
  }),
  RankingRow: obj({
    rank: int("Position"),
    id: int("Player ID"),
    name: str("Name"),
    country: nullable(ref("Country")),
    skill: int("Points"),
    kills: int("Kills"),
    deaths: int("Deaths"),
    headshots: int("Headshots"),
    kpd: { type: "number", description: "Kills per death, two decimals" },
    connectionTime: int("Time on the servers in seconds"),
    lastEvent: unix("Last seen"),
    activity: int("Activity in percent (100 = played today)", { minimum: 0, maximum: 100 }),
  }),
};

schemas.RankingOverview = obj({
  game: str("Code of the ranking"),
  name: str("Name of the ranking"),
  baseGame: nullable(str("Code of the base game (realgame)")),
  servers: int("Servers"),
  players: int("Players online"),
  maxPlayers: int("Slots of all servers"),
  top: nullable(obj({ id: int("Player ID"), name: str("Name"), country: nullable(ref("Country")) })),
  topClan: nullable(obj({ id: int("Clan ID"), tag: str("Clan tag") })),
});
schemas.ServerWithGame = { allOf: [obj({ game: str("Code of the ranking") }), ref("Server")] };
schemas.ServerOnline = { allOf: [ref("Server"), obj({ online: { type: "array", items: ref("LivePlayer") } })] };
schemas.Ranking = obj({
  game: str("Code of the ranking"),
  name: str("Name of the ranking"),
  baseGame: nullable(str("Code of the base game")),
  totals: obj({ players: int("Players"), newPlayers24h: int("New players in the last 24 hours"), kills: int("Kills"), headshots: int("Headshots"), servers: int("Servers") }),
  rankedPlayers: int("Players in the ranking (for paging)"),
  players: { type: "array", items: ref("RankingRow") },
});
schemas.Player = obj({
  id: int("Player ID"),
  game: str("Code of the ranking"),
  name: str("Name"),
  rank: int("Position in the ranking"),
  country: nullable(ref("Country")),
  clan: nullable(obj({ id: int("Clan ID"), tag: str("Clan tag"), name: str("Clan name") })),
  skill: int("Points"),
  kills: int("Kills"),
  deaths: int("Deaths"),
  suicides: int("Suicides"),
  headshots: int("Headshots"),
  teamKills: int("Team kills"),
  killStreak: int("Longest kill streak"),
  kpd: { type: "number", description: "Kills per death, two decimals" },
  shots: int("Shots"),
  hits: int("Hits"),
  rounds: int("Rounds"),
  wins: int("Rounds won"),
  losses: int("Rounds lost"),
  connectionTime: int("Time on the servers in seconds"),
  firstConnect: nullable(unix("First seen")),
  lastEvent: unix("Last seen"),
  activity: int("Activity in percent (100 = played today)", { minimum: 0, maximum: 100 }),
});

const de = { code: "DE", name: "Germany" };
const server = { id: 1, name: "Example Public #1", address: "cs.example.org:27015", map: "de_dust2", players: 2, maxPlayers: 24, mapStarted: 1767225600, kills: 182345, headshots: 61234, rounds: 9876, country: "DE" };
const live = { id: 42, name: "ExamplePlayer", bot: false, team: "CT", kills: 12, deaths: 5, headshots: 4, skill: 1450, skillChange: 23, rank: 7, connectedSince: 1767225900, dead: false, country: de };
const bot = { ...live, id: null, name: "BOT Example", bot: true, team: "TERRORIST", skillChange: 0, rank: 0, country: null };
const row = { rank: 1, id: 42, name: "ExamplePlayer", country: de, skill: 2210, kills: 5321, deaths: 2410, headshots: 1904, kpd: 2.21, connectionTime: 432000, lastEvent: 1767225600, activity: 98 };

export const endpoints: Endpoint[] = [
  {
    path: "/rankings",
    operationId: "listRankings",
    tag: "Rankings",
    summary: "All rankings",
    description: "Every ranking with its servers, the players online and the current number one.",
    schema: { type: "array", items: ref("RankingOverview") },
    example: [{ game: "css", name: "Counter-Strike: Source", baseGame: "css", servers: 2, players: 9, maxPlayers: 48, top: { id: 42, name: "ExamplePlayer", country: de }, topClan: { id: 3, tag: "[EX]" } }],
  },
  {
    path: "/rankings/{game}",
    operationId: "getRanking",
    tag: "Rankings",
    summary: "One ranking",
    description: "Totals of a ranking and its players by points. Hidden players and bots are not ranked.",
    params: [
      gameParam,
      { name: "limit", in: "query", description: "Players per page", schema: int("", { minimum: 1, maximum: 100, default: 10 }) },
      { name: "offset", in: "query", description: "Players to skip", schema: int("", { minimum: 0, maximum: 100000, default: 0 }) },
    ],
    schema: ref("Ranking"),
    example: { game: "css", name: "Counter-Strike: Source", baseGame: "css", totals: { players: 1234, newPlayers24h: 5, kills: 456789, headshots: 123456, servers: 2 }, rankedPlayers: 1180, players: [row] },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/servers",
    operationId: "listRankingServers",
    tag: "Servers",
    summary: "Servers of a ranking",
    description: "The servers of a ranking with who is online on each. Bots have no player ID.",
    params: [gameParam],
    schema: { type: "array", items: ref("ServerOnline") },
    example: [{ ...server, online: [live, bot] }],
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/servers/{id}",
    operationId: "getRankingServer",
    tag: "Servers",
    summary: "One server",
    description: "One server of a ranking with who is online.",
    params: [gameParam, idParam("server")],
    schema: { allOf: [obj({ game: str("Code of the ranking") }), ref("ServerOnline")] },
    example: { game: "css", ...server, online: [live] },
    notFound: "Unknown ranking or server, or the server belongs to another ranking",
  },
  {
    path: "/servers",
    operationId: "listServers",
    tag: "Servers",
    summary: "All servers",
    description: "The servers of all rankings.",
    schema: { type: "array", items: ref("ServerWithGame") },
    example: [{ game: "css", ...server }],
  },
  {
    path: "/players/{id}",
    operationId: "getPlayer",
    tag: "Players",
    summary: "One player",
    description: "Public summary of one player. Hidden players and bots without a profile answer 404.",
    params: [idParam("player")],
    schema: ref("Player"),
    example: { id: 42, game: "css", name: "ExamplePlayer", rank: 1, country: de, clan: { id: 3, tag: "[EX]", name: "Example Clan" }, skill: 2210, kills: 5321, deaths: 2410, suicides: 12, headshots: 1904, teamKills: 3, killStreak: 17, kpd: 2.21, shots: 98000, hits: 31000, rounds: 2100, wins: 1100, losses: 1000, connectionTime: 432000, firstConnect: 1735689600, lastEvent: 1767225600, activity: 98 },
    notFound: "Unknown, hidden or bot player",
  },
];

const errorResponse = (description: string) => ({ description, content: { "application/json": { schema: ref("Error") } } });

export function openApiDocument(version: string) {
  const paths: Record<string, unknown> = {
    "/": {
      get: {
        operationId: "index",
        tags: ["Index"],
        summary: "API index",
        description: "Version and the list of endpoints.",
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: obj({ version: int("API version"), endpoints: { type: "array", items: { type: "string" } } }), example: apiIndex() } },
          },
          "429": errorResponse("Too many requests"),
        },
      },
    },
  };
  for (const e of endpoints) {
    paths[e.path] = {
      get: {
        operationId: e.operationId,
        tags: [e.tag],
        summary: e.summary,
        description: e.description,
        parameters: e.params?.map(({ example, ...p }) => (example === undefined ? p : { ...p, example })),
        responses: {
          "200": { description: "OK", content: { "application/json": { schema: e.schema, example: e.example } } },
          ...(e.notFound ? { "404": errorResponse(e.notFound) } : {}),
          "429": errorResponse("Too many requests (more than 120 per minute from one address); see Retry-After"),
          "500": errorResponse("Internal error"),
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "gameWE API",
      version,
      description: [
        "Read-only JSON API of the gameWE statistics. It returns only what the website shows to everyone: no IP addresses, no chat, no hidden players, no admin data.",
        "",
        "- **Authentication:** none.",
        "- **Rate limit:** 120 requests per minute and client address; above that the answer is `429` with a `Retry-After` header.",
        "- **Caching:** answers may be cached for 30 seconds (`Cache-Control: public, max-age=30`).",
        "- **CORS:** `Access-Control-Allow-Origin: *`, so pages on other sites can call it from the browser.",
        "- **Times** are Unix timestamps in seconds.",
      ].join("\n"),
      license: { name: "GPL-3.0-or-later", identifier: "GPL-3.0-or-later" },
    },
    // Relative, so the examples show the address of the site they are read on.
    servers: [{ url: `${basePath}/api/v1` }],
    tags: [{ name: "Index" }, { name: "Rankings" }, { name: "Servers" }, { name: "Players" }],
    paths,
    components: { schemas },
  };
}

// Answer of /api/v1: the endpoints with the base path.
export function apiIndex() {
  const query = (e: Endpoint) => e.params?.filter((p) => p.in === "query").map((p) => `${p.name}=${(p.schema as { default?: unknown }).default}`).join("&");
  return {
    version: 1,
    docs: `${basePath}/api`,
    endpoints: endpoints.map((e) => `${basePath}/api/v1${e.path}${query(e) ? `?${query(e)}` : ""}`),
  };
}
