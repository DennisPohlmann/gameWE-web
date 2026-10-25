import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET, paged } from "./api-params.ts";
import { basePath } from "./base-path.ts";
import { MAP_SORTS } from "./map-table.ts";
import { PLACE_SORT_ALIASES, PLACE_SORT_DEFAULT, RANKING_SORT_ALIASES, placeSorts, rankingSorts } from "./sorts.ts";
import { rankPlayerSorts } from "./table-sort.ts";

// OpenAPI 3.1 description of the public API (/api/v1/...), shown on /api by
// Scalar and served as /api/openapi.json. One entry per route under
// src/app/api/v1; scripts/vendor.mjs fails the build when a route has no
// entry here. The examples are made-up data on example.org; their ranking
// code is EXAMPLE_GAME, which openApiDocument replaces with the site's
// first ranking. No database access, so `npm test` can load it.

type Schema = Record<string, unknown>;
type Param = { name: string; in: "path" | "query"; description: string; schema: Schema; required?: boolean; example?: unknown };
type Tag = "Rankings" | "Players" | "Countries, states and cities" | "Clans" | "Weapons" | "Maps" | "Awards and ranks" | "Actions and teams" | "Servers" | "Statistics";
type Endpoint = {
  path: string;
  operationId: string;
  tag: Tag;
  summary: string;
  description: string;
  params?: Param[];
  // A paged list: page, limit and offset are added, and the answer is
  // { data: [item], pagination, links }.
  list?: { item: string; sorts?: readonly string[]; sort?: string };
  schema?: Schema;
  example: unknown;
  notFound?: string;
};

const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const int = (description: string, extra: Schema = {}): Schema => ({ type: "integer", description, ...extra });
const num = (description: string, extra: Schema = {}): Schema => ({ type: "number", description, ...extra });
const str = (description: string, extra: Schema = {}): Schema => ({ type: "string", description, ...extra });
const bool = (description: string): Schema => ({ type: "boolean", description });
const nullable = (s: Schema): Schema => ({ anyOf: [s, { type: "null" }] });
const obj = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties) });
const arr = (items: Schema): Schema => ({ type: "array", items });
const unix = (description: string) => int(`${description} (Unix time, seconds)`);
const fraction = (description: string) => nullable(num(`${description}, a fraction with four decimals (0.3125 = 31.25 %); null without a base`, { minimum: 0, maximum: 1 }));
const kpdNum = () => num("Kills per death, two decimals");
const link = (what: string) => str(`Path of ${what} in this API`);
// A field kept under its old name for existing clients.
const deprecated = (s: Schema, now: string): Schema => ({ ...s, deprecated: true, description: `${s.description} (deprecated: use ${now})` });
const pointsInt = (description = "Points, as the website's points column") => int(description);

// Ranking code in the examples; replaced in openApiDocument. Only letters,
// digits, _ and - (as every ranking code), so plain text replacement is safe.
export const EXAMPLE_GAME = "__example_game__";
const G = EXAMPLE_GAME;

const gameParam: Param = { name: "game", in: "path", required: true, description: "Code of the ranking, as in /api/v1/rankings", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: G };
const idParam = (what: string, example = 42): Param => ({ name: "id", in: "path", required: true, description: `ID of the ${what}`, schema: int("", { minimum: 1, maximum: 9999999999 }), example });
const weaponParam: Param = { name: "code", in: "path", required: true, description: "Code of the weapon, as in /weapons", schema: str("", { pattern: "^[A-Za-z0-9_.-]{1,64}$" }), example: "awp" };
const countryQuery: Param = { name: "country", in: "query", description: "Only this country (ISO 3166-1 alpha-2 code, any case)", schema: str("", { pattern: "^[A-Za-z]{2}$" }), example: "de" };
const daysQuery = (def: number, max: number, what: string): Param => ({ name: "days", in: "query", description: what, schema: int("", { minimum: 1, maximum: max, default: def }) });

const pagingParams: Param[] = [
  { name: "page", in: "query", description: "Page, from 1. Use page or offset, not both.", schema: int("", { minimum: 1, default: 1 }) },
  { name: "limit", in: "query", description: "Entries per page", schema: int("", { minimum: 1, maximum: MAX_LIMIT, default: DEFAULT_LIMIT }) },
  { name: "offset", in: "query", description: "Entries to skip instead of a page", schema: int("", { minimum: 0, maximum: MAX_OFFSET }) },
];
const sortParams = (sorts: readonly string[], def: string): Param[] => [
  { name: "sort", in: "query", description: "Sort field", schema: str("", { enum: [...sorts], default: def }) },
  { name: "order", in: "query", description: "Direction; without it names sort ascending and numbers descending", schema: str("", { enum: ["asc", "desc"] }) },
];

const playerTag = { country: nullable(ref("Country")), bot: bool("Bot (bots appear only while the collector ranks them)") };

const schemas: Record<string, Schema> = {
  Error: obj({ error: str("What went wrong: not found, rate limit, internal error, or which parameter is invalid and what it accepts", { examples: ["invalid limit: integer from 1 to 100"] }) }),
  Country: obj({ code: str("ISO 3166-1 alpha-2 code"), name: str("Country name") }),
  Pagination: obj({
    page: int("Current page, from 1"),
    limit: int("Entries per page"),
    offset: int("Entries skipped"),
    total: int("Entries in the whole list"),
    totalPages: int("Pages in the whole list (at least 1)"),
  }),
  Links: obj({
    self: str("This page"),
    first: str("First page"),
    prev: nullable(str("Previous page; null on the first")),
    next: nullable(str("Next page; null on the last")),
    last: str("Last page"),
  }),
  Server: obj({
    id: int("Server ID"),
    name: str("Server name"),
    address: str("Public address with port"),
    map: nullable(str("Current map")),
    players: int("Players online, bots included"),
    bots: int("Bots among the players online"),
    maxPlayers: int("Slots"),
    mapStarted: nullable(unix("Start of the current map")),
    kills: int("Kills on this server"),
    headshots: int("Headshots on this server"),
    hpk: fraction("Headshots per kill"),
    suicides: int("Suicides"),
    rounds: int("Rounds played"),
    ctWins: int("Rounds won by the counter-terrorists (0 in games without sides)"),
    tWins: int("Rounds won by the terrorists (0 in games without sides)"),
    bombsPlanted: int("Bombs planted"),
    bombsDefused: int("Bombs defused"),
    country: nullable(str("ISO code of the server's country")),
    version: nullable(str("Version of the game server, as it reports it (A2S_INFO or RCON status); null when unknown")),
    os: nullable(str("Operating system of the game server: linux, windows or mac; null when unknown")),
    vac: nullable(bool("VAC-secured; null when unknown")),
  }),
  LivePlayer: obj({
    id: nullable(int("Player ID, null for bots")),
    name: str("Name in game"),
    bot: bool("Bot"),
    team: nullable(str("Team")),
    kills: int("Kills this map"),
    deaths: int("Deaths this map"),
    headshots: int("Headshots this map"),
    hpk: fraction("Headshots per kill this map"),
    rounds: int("Rounds this map"),
    shots: int("Shots this map"),
    hits: int("Hits this map"),
    accuracy: fraction("Hits per shot this map"),
    ping: nullable(int("Latency in ms; null while unknown")),
    points: pointsInt(),
    pointsChange: int("Points won or lost this map (the +/- column)"),
    rank: nullable(int("Place in the ranking (1 + players with more points); null for bots and hidden players")),
    skill: deprecated(pointsInt(), "points"),
    skillChange: deprecated(int("Points won or lost this map"), "pointsChange"),
    connectedSince: nullable(unix("Connected since")),
    dead: bool("Dead right now"),
    country: nullable(ref("Country")),
  }),
  RankingRow: obj({
    position: int("Number of the row in this list (the website's # column)"),
    rank: int("Place in the whole ranking by points: 1 + players with more points (equal points share a place), also in a filtered or re-sorted list"),
    id: int("Player ID"),
    name: nullable(str("Name")),
    country: nullable(ref("Country")),
    points: pointsInt(),
    skill: deprecated(pointsInt(), "points"),
    kills: int("Kills"),
    deaths: int("Deaths"),
    headshots: int("Headshots"),
    kpd: kpdNum(),
    hpk: fraction("Headshots per kill"),
    accuracy: fraction("Hits per shot"),
    connectionTime: int("Time on the servers in seconds"),
    firstConnect: nullable(unix("First seen")),
    lastEvent: unix("Last seen"),
    activity: int("Activity in percent (100 = played today)", { minimum: 0, maximum: 100 }),
  }),
  Place: obj({
    rank: nullable(int("Position in this list")),
    country: ref("Country"),
    players: int("Ranked players"),
    avgPoints: int("Average points of its players (the website's Avg. points column)"),
    totalPoints: int("Points of all its players (the website's Total points column)"),
    skill: deprecated(int("Points of all its players"), "totalPoints"),
    avgSkill: deprecated(int("Average points"), "avgPoints"),
    kills: int("Kills"),
    deaths: int("Deaths"),
    headshots: int("Headshots"),
    kpd: kpdNum(),
    hpk: fraction("Headshots per kill"),
    connectionTime: int("Time on the servers in seconds"),
    lastEvent: unix("Last seen of its most recent player"),
    playersUrl: link("its players (/rankings/{game}/players with country, state or city)"),
  }),
  Clan: obj({
    id: int("Clan ID"),
    tag: str("Clan tag"),
    name: str("Clan name"),
    homepage: nullable(str("Homepage (http or https only)")),
    country: nullable(ref("Country")),
    members: int("Ranked members"),
    avgPoints: int("Average points of the members"),
    avgSkill: deprecated(int("Average points of the members"), "avgPoints"),
    kills: int("Kills"),
    deaths: int("Deaths"),
    headshots: int("Headshots"),
    kpd: kpdNum(),
    hpk: fraction("Headshots per kill"),
    connectionTime: int("Time on the servers in seconds"),
    lastEvent: nullable(unix("Last seen of its most recent member")),
  }),
  Weapon: obj({
    rank: int("Position in this list"),
    code: str("Weapon code"),
    name: str("Weapon name (the code when it has none)"),
    modifier: num("Points modifier"),
    kills: int("Kills"),
    killShare: fraction("Share of all kills of the ranking's weapons"),
    headshots: int("Headshots"),
    headshotShare: fraction("Share of all headshots of the ranking's weapons"),
    hpk: fraction("Headshots per kill"),
  }),
  WeaponPlayer: obj({
    rank: int("Position in this list"),
    id: int("Player ID"),
    name: nullable(str("Name")),
    ...playerTag,
    kills: int("Kills with this weapon"),
    headshots: int("Headshots"),
    shots: int("Shots"),
    hits: int("Hits"),
    hpk: fraction("Headshots per kill"),
    accuracy: fraction("Hits per shot"),
  }),
  Map: obj({
    id: int("Map ID"),
    name: str("Map name"),
    kills: int("Kills"),
    headshots: int("Headshots"),
    hpk: fraction("Headshots per kill"),
    teamKills: int("Team kills"),
    teamAWins: int("Rounds won by the first team (e.g. terrorists)"),
    teamBWins: int("Rounds won by the second team (e.g. counter-terrorists)"),
    played: int("Times played"),
    playTime: int("Time played in seconds"),
    rounds: int("Rounds"),
    ctWins: nullable(int("Rounds won by the counter-terrorists; null in rankings without sides and without recorded wins")),
    tWins: nullable(int("Rounds won by the terrorists; null in rankings without sides and without recorded wins")),
    winRatio: nullable(obj({ ct: int("CT share of the round wins in whole percent (a side with a win never shows 0)"), t: int("T share in whole percent (ct + t = 100)") })),
  }),
  MapPlayer: obj({
    position: int("Number of the row in this list"),
    id: int("Player ID"),
    name: nullable(str("Name")),
    ...playerTag,
    rank: nullable(int("Place in the whole ranking by points (the website's Position column); null with days")),
    kills: int("Kills on this map"),
    deaths: int("Deaths on this map"),
    headshots: int("Headshots"),
    kpd: kpdNum(),
    hpk: fraction("Headshots per kill"),
    ggWins: nullable(int("GunGame wins on this map; null outside GunGame rankings and with days")),
  }),
  Action: obj({
    rank: int("Position in this list"),
    id: int("Action ID"),
    code: str("Action code"),
    description: nullable(str("Description")),
    team: nullable(str("Team the action is for")),
    bonus: int("Points bonus as the website shows it: the player reward, else the team reward"),
    rewardPlayer: int("Points for the player"),
    rewardTeam: int("Points for the team"),
    count: int("Times it happened"),
    share: fraction("Share of all actions of the ranking"),
    playersUrl: link("the action with its best players"),
  }),
  AwardWinner: obj({ id: int("Player ID"), name: nullable(str("Name")), ...playerTag, value: int("Count (kills, actions, seconds for longest_playtime, ...)") }),
  RankPlayer: obj({
    position: int("Number of the row in this list"),
    id: int("Player ID"),
    name: nullable(str("Name")),
    ...playerTag,
    kills: int("Kills"),
    progress: num("Progress to the next rank, 0 to 1 (1 in the highest rank)", { minimum: 0, maximum: 1 }),
    points: pointsInt(),
    skill: deprecated(pointsInt(), "points"),
    connectionTime: int("Time on the servers in seconds"),
    lastEvent: unix("Last seen"),
    activity: int("Activity in percent (100 = played today)", { minimum: 0, maximum: 100 }),
  }),
  DayActivity: obj({ day: str("Day (YYYY-MM-DD, site time zone)", { format: "date" }), players: int("Active players"), kills: int("Kills"), headshots: int("Headshots") }),
  PlayerWeapon: obj({
    code: str("Weapon code"),
    name: str("Weapon name"),
    kills: int("Kills"),
    deaths: int("Deaths by this weapon"),
    headshots: int("Headshots"),
    shots: int("Shots"),
    hits: int("Hits"),
    damage: int("Damage"),
    kpd: kpdNum(),
    hpk: fraction("Headshots per kill"),
    accuracy: fraction("Hits per shot"),
    damagePerHit: nullable(num("Damage per hit, two decimals; null without hits")),
    shotsPerKill: nullable(num("Shots per kill, two decimals; null without kills")),
    hitboxes: ref("Hitboxes"),
  }),
  Hitboxes: obj(Object.fromEntries(["head", "chest", "stomach", "leftarm", "rightarm", "leftleg", "rightleg"].map((z) => [z, int(`Hits on ${z}`)]))),
  PlayerMap: obj({ id: int("Map ID"), name: str("Map name"), kills: int("Kills"), deaths: int("Deaths"), headshots: int("Headshots"), kpd: kpdNum(), hpk: fraction("Headshots per kill") }),
  PlayerDay: obj({
    day: str("Day (YYYY-MM-DD)", { format: "date" }),
    points: int("Points at the end of the day"),
    pointsChange: int("Points won or lost that day: the points against the player's previous day with history (for the oldest day, the change the collector recorded that day)"),
    skill: deprecated(int("Points at the end of the day"), "points"),
    skillChange: deprecated(int("Points won or lost that day"), "pointsChange"),
    connectionTime: int("Time on the servers in seconds"),
    rounds: int("Rounds"),
    wins: int("Rounds won"),
    kills: int("Kills"),
    deaths: int("Deaths"),
    kpd: kpdNum(),
    headshots: int("Headshots"),
    hpk: fraction("Headshots per kill"),
    killStreak: int("Longest kill streak"),
    shots: int("Shots"),
    hits: int("Hits"),
    accuracy: fraction("Hits per shot"),
  }),
  PlayerAward: obj({ day: str("Day won (YYYY-MM-DD)", { format: "date" }), id: int("Award ID"), code: str("Award code"), name: str("Award name"), verb: str("What was counted"), value: int("Count that day") }),
};

const pageSchema = (item: string): Schema => obj({ data: arr(ref(item)), pagination: ref("Pagination"), links: ref("Links") });

const RankingOverview = obj({
  game: str("Code of the ranking"),
  name: str("Name of the ranking"),
  baseGame: nullable(str("Code of the base game (realgame)")),
  servers: int("Servers"),
  players: int("Players online, bots included"),
  bots: int("Bots among the players online"),
  maxPlayers: int("Slots of all servers"),
  top: nullable(obj({ id: int("Player ID"), name: str("Name"), country: nullable(ref("Country")) })),
  topClan: nullable(obj({ id: int("Clan ID"), tag: str("Clan tag") })),
});
const OPPONENT = obj({ id: int("Player ID"), name: nullable(str("Name")), ...playerTag, kills: int("Kills"), headshots: int("Headshots"), hpk: fraction("Headshots per kill") });
const ServerOnline: Schema = { allOf: [ref("Server"), obj({ online: arr(ref("LivePlayer")) })] };
const withGame = (s: Schema): Schema => ({ allOf: [obj({ game: str("Code of the ranking") }), s] });

// ---------------------------------------------------------------- examples

const de = { code: "DE", name: "Germany" };
const v1 = (path: string) => `${basePath}/api/v1${path}`;
const page = <T>(items: T[], total: number, path: string, args: Record<string, string | number> = {}) =>
  paged(items, total, { page: 1, limit: DEFAULT_LIMIT, offset: 0 }, v1(path), args);
const server = {
  id: 1,
  name: "Example Public #1",
  address: "cs.example.org:27015",
  map: "de_dust2",
  players: 2,
  bots: 0,
  maxPlayers: 24,
  mapStarted: 1767225600,
  kills: 182345,
  headshots: 61234,
  hpk: 0.3358,
  suicides: 412,
  rounds: 9876,
  ctWins: 4876,
  tWins: 5000,
  bombsPlanted: 2345,
  bombsDefused: 987,
  country: "DE",
  version: "9540945",
  os: "linux",
  vac: true,
};
const live = { id: 42, name: "ExamplePlayer", bot: false, team: "CT", kills: 12, deaths: 5, headshots: 4, hpk: 0.3333, rounds: 9, shots: 140, hits: 41, accuracy: 0.2929, ping: 35, points: 1450, pointsChange: 23, rank: 7, skill: 1450, skillChange: 23, connectedSince: 1767225900, dead: false, country: de };
const bot = { ...live, id: null, name: "BOT Example", bot: true, team: "TERRORIST", ping: null, pointsChange: 0, skillChange: 0, rank: null, country: null };
const row = { position: 1, rank: 1, id: 42, name: "ExamplePlayer", country: de, points: 2210, skill: 2210, kills: 5321, deaths: 2410, headshots: 1904, kpd: 2.21, hpk: 0.3578, accuracy: 0.3163, connectionTime: 432000, firstConnect: 1735689600, lastEvent: 1767225600, activity: 98 };
const place = { rank: 1, country: de, players: 412, avgPoints: 1209, totalPoints: 498000, skill: 498000, avgSkill: 1209, kills: 812345, deaths: 790122, headshots: 260111, kpd: 1.03, hpk: 0.3202, connectionTime: 98765432, lastEvent: 1767225600, playersUrl: `${v1(`/rankings/${G}/players`)}?country=de` };
const clan = { id: 3, tag: "[EX]", name: "Example Clan", homepage: "https://clan.example.org/", country: de, members: 8, avgPoints: 1650, avgSkill: 1650, kills: 23456, deaths: 19876, headshots: 7012, kpd: 1.18, hpk: 0.299, connectionTime: 1234567, lastEvent: 1767225600 };
const weapon = { rank: 1, code: "ak47", name: "AK-47", modifier: 1, kills: 123456, killShare: 0.2612, headshots: 45678, headshotShare: 0.3011, hpk: 0.37 };
const map = { id: 7, name: "de_dust2", kills: 345678, headshots: 112233, hpk: 0.3247, teamKills: 321, teamAWins: 5012, teamBWins: 4876, played: 2345, playTime: 3456789, rounds: 9888, ctWins: 4876, tWins: 5012, winRatio: { ct: 49, t: 51 } };
const tag = { country: de, bot: false };
const zones = { head: 1904, chest: 5120, stomach: 2310, leftarm: 880, rightarm: 910, leftleg: 640, rightleg: 655 };
const days = [
  { day: "2026-01-01", players: 31, kills: 4210, headshots: 1388 },
  { day: "2026-01-02", players: 28, kills: 3987, headshots: 1290 },
];

// Sort keys as the routes accept them; points (and its relatives) are other
// names of skill, as the website calls the column.
const PLAYER_SORTS = [...Object.keys(rankingSorts), ...Object.keys(RANKING_SORT_ALIASES)];
const PLACE_SORTS = [...Object.keys(placeSorts), ...Object.keys(PLACE_SORT_ALIASES)];
const CLAN_SORTS = ["skill", "members", "kills", "deaths", "headshots", "kpd", "hpk", "time", "activity", "tag", "points", "avgPoints"];

export const endpoints: Endpoint[] = [
  // ------------------------------------------------------------ rankings
  {
    path: "/rankings",
    operationId: "listRankings",
    tag: "Rankings",
    summary: "All rankings",
    description: "Every ranking with its servers, the players online and the current number one.",
    schema: arr(RankingOverview),
    example: [{ game: G, name: "Counter-Strike: Source", baseGame: "css", servers: 2, players: 9, bots: 0, maxPlayers: 48, top: { id: 42, name: "ExamplePlayer", country: de }, topClan: { id: 3, tag: "[EX]" } }],
  },
  {
    path: "/rankings/{game}",
    operationId: "getRanking",
    tag: "Rankings",
    summary: "One ranking",
    description: "Totals of a ranking and its best players by points. For paging, filters and sorting use `/rankings/{game}/players`.",
    params: [
      gameParam,
      { name: "limit", in: "query", description: "Players", schema: int("", { minimum: 1, maximum: MAX_LIMIT, default: 10 }) },
      { name: "offset", in: "query", description: "Players to skip", schema: int("", { minimum: 0, maximum: MAX_OFFSET, default: 0 }) },
    ],
    schema: obj({
      game: str("Code of the ranking"),
      name: str("Name of the ranking"),
      baseGame: nullable(str("Code of the base game")),
      totals: obj({ players: int("Players"), newPlayers24h: int("New players in the last 24 hours"), kills: int("Kills"), headshots: int("Headshots"), servers: int("Servers") }),
      rankedPlayers: int("Players in the ranking"),
      players: arr(ref("RankingRow")),
    }),
    example: { game: G, name: "Counter-Strike: Source", baseGame: "css", totals: { players: 1234, newPlayers24h: 5, kills: 456789, headshots: 123456, servers: 2 }, rankedPlayers: 1180, players: [row] },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/players",
    operationId: "listRankingPlayers",
    tag: "Players",
    summary: "Players of a ranking",
    description:
      "The ranking as a paged list with the columns and filters of the website's ranking: country, state, city, clan and a name search. `position` numbers the rows of this list (the website's # column), `rank` is always the place in the whole ranking by points, also in a filtered or re-sorted list. Hidden and banned players are not listed. Sort fields: `points` (or `skill`), `name`, `activity` last seen, `time` time on the servers, `kills`, `deaths`, `kpd`, `hs` headshots, `hpk` headshots per kill, `acc` accuracy, `new` first seen; ties by player ID.",
    params: [
      gameParam,
      countryQuery,
      { name: "state", in: "query", description: "Only this state or region (exact GeoIP name, any case; best together with country)", schema: str("", { maxLength: 80 }), example: "Bavaria" },
      { name: "city", in: "query", description: "Only this city (exact name, any case; best together with country)", schema: str("", { maxLength: 80 }), example: "Berlin" },
      { name: "clan", in: "query", description: "Only members of this clan (clan ID)", schema: int("", { minimum: 1 }) },
      { name: "q", in: "query", description: "Part of the current name", schema: str("", { maxLength: 64 }) },
    ],
    list: { item: "RankingRow", sorts: PLAYER_SORTS, sort: "skill" },
    example: page([row], 1180, `/rankings/${G}/players`),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/stats",
    operationId: "getRankingStats",
    tag: "Statistics",
    summary: "Statistics of a ranking",
    description: "Totals of a ranking and its activity per day (active players, kills, headshots), oldest day first; days without data are 0.",
    params: [gameParam, daysQuery(30, 365, "Days back, today included")],
    schema: obj({
      game: str("Code of the ranking"),
      name: str("Name of the ranking"),
      baseGame: nullable(str("Code of the base game")),
      totals: obj({ players: int("Players"), rankedPlayers: int("Players in the ranking"), newPlayers24h: int("New players in the last 24 hours"), kills: int("Kills"), headshots: int("Headshots"), servers: int("Servers") }),
      days: arr(ref("DayActivity")),
    }),
    example: { game: G, name: "Counter-Strike: Source", baseGame: "css", totals: { players: 1234, rankedPlayers: 1180, newPlayers24h: 5, kills: 456789, headshots: 123456, servers: 2 }, days },
    notFound: "Unknown ranking",
  },
  // ------------------------------------------------------------ countries, states and cities
  {
    path: "/rankings/{game}/countries",
    operationId: "listCountries",
    tag: "Countries, states and cities",
    summary: "Country ranking",
    description: "Countries of the ranked players (by GeoIP of their last connect) with summed and averaged values, by total points (`?sort=players` orders by number of players). `avg` (or `avgPoints`) sorts by average points, `skill` (or `points`, `totalPoints`) by total points.",
    params: [gameParam],
    list: { item: "Place", sorts: PLACE_SORTS, sort: PLACE_SORT_DEFAULT },
    example: page([place], 34, `/rankings/${G}/countries`),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/countries/{country}",
    operationId: "getCountry",
    tag: "Countries, states and cities",
    summary: "One country",
    description: "Totals of one country and its place in the country ranking by total points. Its players: `playersUrl`.",
    params: [gameParam, { name: "country", in: "path", required: true, description: "ISO 3166-1 alpha-2 code, any case", schema: str("", { pattern: "^[A-Za-z]{2}$" }), example: "de" }],
    schema: withGame(ref("Place")),
    example: { game: G, ...place },
    notFound: "Unknown ranking, or no ranked player from this country",
  },
  {
    path: "/rankings/{game}/states",
    operationId: "listStates",
    tag: "Countries, states and cities",
    summary: "State ranking",
    description: "States and regions of the ranked players (GeoIP subdivision of their last connect), optionally of one country, by total points (`?sort=players` orders by number of players). States are counted per country, so the same name in two countries stays apart. Its players: `playersUrl` (country and state filter of `/players`).",
    params: [gameParam, countryQuery],
    list: { item: "PlaceState", sorts: PLACE_SORTS, sort: PLACE_SORT_DEFAULT },
    example: page([{ ...place, state: "Bavaria", players: 88, playersUrl: `${v1(`/rankings/${G}/players`)}?country=de&state=Bavaria` }], 16, `/rankings/${G}/states`, { country: "de" }),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/cities",
    operationId: "listCities",
    tag: "Countries, states and cities",
    summary: "City ranking",
    description: "Cities of the ranked players, optionally of one country, by total points (`?sort=players` orders by number of players). Its players: `playersUrl` (country and city filter of `/players`).",
    params: [gameParam, countryQuery],
    list: { item: "PlaceCity", sorts: PLACE_SORTS, sort: PLACE_SORT_DEFAULT },
    example: page([{ ...place, city: "Berlin", players: 57, playersUrl: `${v1(`/rankings/${G}/players`)}?country=de&city=Berlin` }], 120, `/rankings/${G}/cities`, { country: "de" }),
    notFound: "Unknown ranking",
  },
  // ------------------------------------------------------------ clans
  {
    path: "/rankings/{game}/clans",
    operationId: "listClans",
    tag: "Clans",
    summary: "Clan ranking",
    description: "Clans with at least two ranked members, by average points. The country is the most common one among the members.",
    params: [gameParam],
    list: { item: "ClanRanked", sorts: CLAN_SORTS, sort: "skill" },
    example: page([{ rank: 1, ...clan }], 12, `/rankings/${G}/clans`),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}",
    operationId: "getClan",
    tag: "Clans",
    summary: "One clan",
    description: "One clan with the totals of its ranked members.",
    params: [gameParam, idParam("clan", 3)],
    schema: { allOf: [obj({ game: str("Code of the ranking") }), ref("Clan"), obj({ membersUrl: link("its members") })] },
    example: { game: G, ...clan, membersUrl: v1(`/rankings/${G}/clans/3/members`) },
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}/members",
    operationId: "listClanMembers",
    tag: "Clans",
    summary: "Members of a clan",
    description: "The ranked members of a clan (the website's clan page); `position` numbers the rows, `rank` is the place in the whole ranking. Sort fields as in `/players`.",
    params: [gameParam, idParam("clan", 3)],
    list: { item: "RankingRow", sorts: PLAYER_SORTS, sort: "skill" },
    example: page([row], 8, `/rankings/${G}/clans/3/members`),
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  // ------------------------------------------------------------ weapons
  {
    path: "/rankings/{game}/weapons",
    operationId: "listWeapons",
    tag: "Weapons",
    summary: "Weapons",
    description: "The weapons of a ranking that have kills, by kills, with the columns of the website's weapons table (kills and headshots with their share of all).",
    params: [gameParam],
    list: { item: "Weapon", sorts: ["kills", "headshots", "hpk", "modifier", "name", "code"], sort: "kills" },
    example: page([weapon], 28, `/rankings/${G}/weapons`),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/weapons/{code}",
    operationId: "getWeapon",
    tag: "Weapons",
    summary: "One weapon",
    description: "Totals of one weapon. Its best players: `playersUrl`.",
    params: [gameParam, weaponParam],
    schema: obj({
      game: str("Code of the ranking"),
      code: str("Weapon code"),
      name: str("Weapon name"),
      modifier: num("Points modifier"),
      kills: int("Kills"),
      headshots: int("Headshots"),
      hpk: fraction("Headshots per kill"),
      playersUrl: link("its best players"),
    }),
    example: { game: G, code: "awp", name: "AWP", modifier: 1, kills: 54321, headshots: 9876, hpk: 0.1818, playersUrl: v1(`/rankings/${G}/weapons/awp/players`) },
    notFound: "Unknown ranking or weapon",
  },
  {
    path: "/rankings/{game}/weapons/{code}/players",
    operationId: "listWeaponPlayers",
    tag: "Weapons",
    summary: "Best players with a weapon",
    description: "Ranked players with kills by this weapon, by kills (all time).",
    params: [gameParam, weaponParam],
    list: { item: "WeaponPlayer" },
    example: page([{ rank: 1, id: 42, name: "ExamplePlayer", ...tag, kills: 1234, headshots: 345, shots: 5678, hits: 2345, hpk: 0.2796, accuracy: 0.413 }], 410, `/rankings/${G}/weapons/awp/players`),
    notFound: "Unknown ranking or weapon",
  },
  // ------------------------------------------------------------ maps
  {
    path: "/rankings/{game}/maps",
    operationId: "listMaps",
    tag: "Maps",
    summary: "Maps",
    description: "The maps of a ranking that were played, by kills, with the columns of the website's maps table: time, kills and headshots with their share of all maps, CT/T round wins.",
    params: [gameParam],
    list: { item: "MapRanked", sorts: ["kills", "headshots", "hpk", "played", "time", "rounds", "name", "map"], sort: "kills" },
    example: page([{ rank: 1, ...map, timeShare: 0.2134, killShare: 0.3012, headshotShare: 0.2988 }], 15, `/rankings/${G}/maps`),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/maps/{id}",
    operationId: "getMap",
    tag: "Maps",
    summary: "One map",
    description: "One map with the details of the website's map page: play time (stored or counted from the server load, the larger), CT/T round wins, kills per minute, accuracy and the kills of hidden players. Its players: `playersUrl`.",
    params: [gameParam, idParam("map", 7)],
    schema: {
      allOf: [
        obj({ game: str("Code of the ranking") }),
        ref("Map"),
        obj({
          killsPerMinute: nullable(num("Kills per minute of play time, two decimals; null without play time")),
          accuracy: nullable(fraction("Hits per shot from the per-map player stats; null when there are none")),
          players: int("Ranked players with a kill on this map"),
          hiddenKills: int("Kills by hidden players (counted, not listed)"),
          playersUrl: link("its players"),
        }),
      ],
    },
    example: { game: G, ...map, killsPerMinute: 6.01, accuracy: null, players: 96, hiddenKills: 12, playersUrl: v1(`/rankings/${G}/maps/7/players`) },
    notFound: "Unknown map, or the map belongs to another ranking",
  },
  {
    path: "/rankings/{game}/maps/{id}/players",
    operationId: "listMapPlayers",
    tag: "Maps",
    summary: "Players on a map",
    description:
      "The ranked players with a kill on this map, all time, as the website's map page (from the kill events): by kills, with each one's place in the ranking (`rank`, sort `position` or `rank`) and the GunGame wins in GunGame rankings. Sort fields: `kills`, `deaths`, `kpd`, `hs` (or `headshots`), `hpk`, `name`, `position`. With `days` only the last days, by kills (no `sort`).",
    params: [gameParam, idParam("map", 7), { name: "days", in: "query", description: "Only the last days (1-90), by kills", schema: int("", { minimum: 1, maximum: 90 }) }],
    list: { item: "MapPlayer", sorts: [...MAP_SORTS, "headshots", "rank"], sort: "kills" },
    example: page([{ position: 1, id: 42, name: "ExamplePlayer", ...tag, rank: 3, kills: 512, deaths: 230, headshots: 171, kpd: 2.23, hpk: 0.334, ggWins: null }], 96, `/rankings/${G}/maps/7/players`),
    notFound: "Unknown map, or the map belongs to another ranking",
  },
  // ------------------------------------------------------------ awards and ranks
  {
    path: "/rankings/{game}/awards",
    operationId: "getAwards",
    tag: "Awards and ranks",
    summary: "Daily awards",
    description:
      "One entry per award of the ranking (not paged). Without `day`: yesterday's winners and today's leaders, as on the website. With `day` (one of the last 365 days): the winners of that day; for today the current leaders. Hidden players are left out (`null`).",
    params: [gameParam, { name: "day", in: "query", description: "Day as YYYY-MM-DD", schema: str("", { format: "date" }), example: "2026-01-01" }],
    schema: obj({
      game: str("Code of the ranking"),
      day: str("Day of the winners", { format: "date" }),
      leadersDay: nullable(str("Day of the leaders (today) when the answer has them", { format: "date" })),
      data: arr(
        obj({
          id: int("Award ID"),
          type: str("W = weapon, O = action or player value, P = player value"),
          code: str("Weapon, action or player value counted"),
          name: str("Award name"),
          verb: str("What is counted"),
          winner: nullable(ref("AwardWinner")),
          leader: nullable(ref("AwardWinner")),
        }),
      ),
    }),
    example: {
      game: G,
      day: "2026-01-01",
      leadersDay: "2026-01-02",
      data: [{ id: 5, type: "W", code: "awp", name: "AWP Master", verb: "kills with awp", winner: { id: 42, name: "ExamplePlayer", ...tag, value: 37 }, leader: null }],
    },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/ribbons",
    operationId: "getRibbons",
    tag: "Awards and ranks",
    summary: "Ribbons and most decorated",
    description: "Global awards: per award how many players won it, how many reached each ribbon class and who won it most often; and the ten players with the most award wins.",
    params: [gameParam],
    schema: obj({
      game: str("Code of the ranking"),
      classes: arr(obj({ index: int("Class, from 0"), name: str("Class name (language key, e.g. {LANG_GOLD})"), levels: int("Levels in this class"), winsPerLevel: int("Wins per level") })),
      data: arr(
        obj({
          id: int("Award ID"),
          code: str("Award code"),
          name: str("Award name"),
          verb: str("What is counted"),
          holders: int("Players who won it"),
          perClass: arr(int("Players who reached the class with the same index")),
          leader: nullable(obj({ id: int("Player ID"), name: nullable(str("Name")), ...playerTag, wins: int("Wins") })),
        }),
      ),
      mostDecorated: arr(obj({ rank: int("Position"), id: int("Player ID"), name: nullable(str("Name")), ...playerTag, wins: int("Award wins"), kills: int("Kills") })),
    }),
    example: {
      game: G,
      classes: [{ index: 0, name: "{LANG_BRONZE}", levels: 8, winsPerLevel: 1 }],
      data: [{ id: 5, code: "awp", name: "AWP Master", verb: "kills with awp", holders: 23, perClass: [23], leader: { id: 42, name: "ExamplePlayer", ...tag, wins: 14 } }],
      mostDecorated: [{ rank: 1, id: 42, name: "ExamplePlayer", ...tag, wins: 61, kills: 5321 }],
    },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/ranks",
    operationId: "listRanks",
    tag: "Awards and ranks",
    summary: "Ranks",
    description: "The ranks of a ranking (kill thresholds, lowest first) with the number of ranked players in each (not paged).",
    params: [gameParam],
    schema: obj({
      game: str("Code of the ranking"),
      rankedPlayers: int("Players in the ranking"),
      data: arr(
        obj({
          index: int("Rank index, from 0 (for /ranks/{rank}/players)"),
          name: str("Rank name"),
          minKills: int("Kills needed"),
          maxKills: nullable(int("Last kill count of this rank; null for the highest")),
          players: int("Ranked players in this rank"),
          share: fraction("Share of the ranked players"),
          playersUrl: link("its players"),
        }),
      ),
    }),
    example: { game: G, rankedPlayers: 1180, data: [{ index: 0, name: "Private", minKills: 0, maxKills: 49, players: 610, share: 0.5169, playersUrl: v1(`/rankings/${G}/ranks/0/players`) }] },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/ranks/{rank}/players",
    operationId: "listRankPlayers",
    tag: "Awards and ranks",
    summary: "Players of a rank",
    description: "The ranked players of one rank, by kills, with the columns of the website's rank table (kills, progress to the next rank, points, time, activity). Sort fields: `kills`, `name`, `points` (or `skill`), `time`, `activity`.",
    params: [gameParam, { name: "rank", in: "path", required: true, description: "Rank index from /ranks", schema: int("", { minimum: 0, maximum: 999 }), example: 0 }],
    list: { item: "RankPlayer", sorts: [...Object.keys(rankPlayerSorts), "points"], sort: "kills" },
    example: page(
      [{ position: 1, id: 42, name: "ExamplePlayer", ...tag, kills: 48, progress: 0.96, points: 1210, skill: 1210, connectionTime: 7200, lastEvent: 1767225600, activity: 97 }],
      610,
      `/rankings/${G}/ranks/0/players`,
    ),
    notFound: "Unknown ranking or rank",
  },
  // ------------------------------------------------------------ actions and teams
  {
    path: "/rankings/{game}/actions",
    operationId: "listActions",
    tag: "Actions and teams",
    summary: "Actions",
    description: "The actions of a ranking that happened (bomb planted, flag captured, ...), by count, with the columns of the website's actions table. `reward` (or `bonus`) sorts by the points bonus.",
    params: [gameParam],
    list: { item: "Action", sorts: ["count", "reward", "name", "bonus"], sort: "count" },
    example: page(
      [{ rank: 1, id: 11, code: "Planted_The_Bomb", description: "Planted the bomb", team: "TERRORIST", bonus: 3, rewardPlayer: 3, rewardTeam: 0, count: 2345, share: 0.2101, playersUrl: v1(`/rankings/${G}/actions/11`) }],
      9,
      `/rankings/${G}/actions`,
    ),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/actions/{id}",
    operationId: "getAction",
    tag: "Actions and teams",
    summary: "One action",
    description: "One action with its best players, as the website's action page: how often each triggered it and the points it brought, most often first (at most 50).",
    params: [gameParam, idParam("action", 11)],
    schema: obj({
      game: str("Code of the ranking"),
      id: int("Action ID"),
      code: str("Action code"),
      description: nullable(str("Description")),
      team: nullable(str("Team the action is for")),
      bonus: int("Points bonus: the player reward, else the team reward"),
      rewardPlayer: int("Points for the player"),
      rewardTeam: int("Points for the team"),
      count: int("Times it happened"),
      players: arr(obj({ position: int("Position"), id: int("Player ID"), name: nullable(str("Name")), ...playerTag, count: int("Times this player triggered it"), points: int("Points it brought this player") })),
    }),
    example: {
      game: G,
      id: 11,
      code: "Planted_The_Bomb",
      description: "Planted the bomb",
      team: "TERRORIST",
      bonus: 3,
      rewardPlayer: 3,
      rewardTeam: 0,
      count: 2345,
      players: [{ position: 1, id: 42, name: "ExamplePlayer", ...tag, count: 120, points: 360 }],
    },
    notFound: "Unknown action, or the action belongs to another ranking",
  },
  {
    path: "/rankings/{game}/teams",
    operationId: "listTeams",
    tag: "Actions and teams",
    summary: "Teams and roles",
    description: "The teams of a ranking with how often players (not hidden ones) joined them, and its roles (classes), not paged, as the website's teams page: most time first, time, kills and deaths with their share of the table. Teams and roles without time, kills or deaths are left out.",
    params: [gameParam],
    schema: obj({ game: str("Code of the ranking"), teams: arr(ref("TeamWithJoins")), roles: arr(ref("Team")) }),
    example: {
      game: G,
      teams: [
        { position: 1, id: 1, code: "CT", name: "Counter-Terrorists", timePlayed: 3456789, timeShare: 0.5012, kills: 41234, killShare: 0.4987, deaths: 41002, deathShare: 0.5003, headshots: 13456, kpd: 1.01, wins: 4876, losses: 5012, rounds: 9888, joined: 8123 },
      ],
      roles: [],
    },
    notFound: "Unknown ranking",
  },
  // ------------------------------------------------------------ servers
  {
    path: "/rankings/{game}/servers",
    operationId: "listRankingServers",
    tag: "Servers",
    summary: "Servers of a ranking",
    description: "The servers of a ranking with who is online on each. Bots have no player ID.",
    params: [gameParam],
    schema: arr(ServerOnline),
    example: [{ ...server, online: [live, bot] }],
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/servers/{id}",
    operationId: "getRankingServer",
    tag: "Servers",
    summary: "One server",
    description: "One server of a ranking with the values of the website's server page (kills, headshots, suicides, rounds, CT/T wins, bombs) and who is online (hidden players without ID, as on the website).",
    params: [gameParam, idParam("server", 1)],
    schema: withGame(ServerOnline),
    example: { game: G, ...server, online: [live] },
    notFound: "Unknown ranking or server, or the server belongs to another ranking",
  },
  {
    path: "/rankings/{game}/servers/{id}/load",
    operationId: "getRankingServerLoad",
    tag: "Servers",
    summary: "Server load",
    description: "Players on one server over the last hours, one point per 10 minutes (bots included), oldest first.",
    params: [gameParam, idParam("server", 1), { name: "hours", in: "query", description: "Hours back", schema: int("", { minimum: 1, maximum: 168, default: 24 }) }],
    schema: obj({
      game: str("Code of the ranking"),
      id: int("Server ID"),
      hours: int("Hours back"),
      maxPlayers: int("Slots now"),
      data: arr(obj({ time: unix("Time"), players: int("Players at that time"), min: int("Fewest players in the 10 minutes"), max: int("Most players in the 10 minutes"), map: nullable(str("Map")) })),
    }),
    example: { game: G, id: 1, hours: 24, maxPlayers: 24, data: [{ time: 1767225600, players: 12, min: 10, max: 14, map: "de_dust2" }] },
    notFound: "Unknown ranking or server, or the server belongs to another ranking",
  },
  {
    path: "/servers",
    operationId: "listServers",
    tag: "Servers",
    summary: "All servers",
    description: "The servers of all rankings.",
    schema: arr(withGame(ref("Server"))),
    example: [{ game: G, ...server }],
  },
  {
    path: "/stats",
    operationId: "getStats",
    tag: "Statistics",
    summary: "Statistics of all rankings",
    description: "Totals over all rankings and the activity per day (players active in any ranking, kills, headshots), oldest day first.",
    params: [daysQuery(30, 365, "Days back, today included")],
    schema: obj({
      totals: obj({ rankings: int("Rankings with servers"), servers: int("Servers"), players: int("Players"), clans: int("Clans"), kills: int("Kills"), deaths: int("Deaths"), headshots: int("Headshots") }),
      days: arr(ref("DayActivity")),
    }),
    example: { totals: { rankings: 2, servers: 3, players: 2345, clans: 21, kills: 987654, deaths: 965432, headshots: 312345 }, days },
  },
  // ------------------------------------------------------------ players
  {
    path: "/players/{id}",
    operationId: "getPlayer",
    tag: "Players",
    summary: "One player",
    description:
      "Public summary of one player with the values of the website's profile (player profile and summary). Hidden or banned players, bots without a profile and players of hidden rankings answer 404, also on all `/players/{id}/...` endpoints. No Steam ID, Steam profile, IP address or chat.",
    params: [idParam("player")],
    schema: obj({
      id: int("Player ID"),
      game: str("Code of the ranking"),
      name: nullable(str("Name")),
      rank: nullable(int("Place in the ranking (1 + players with more points), the profile's Position")),
      country: nullable(ref("Country")),
      state: nullable(str("State or region of the last connect (GeoIP)")),
      city: nullable(str("City of the last connect (GeoIP)")),
      clan: nullable(obj({ id: int("Clan ID"), tag: str("Clan tag"), name: str("Clan name") })),
      points: pointsInt(),
      pointsChange: int("Points won or lost at the last event (beside the points on the profile)"),
      skill: deprecated(pointsInt(), "points"),
      kills: int("Kills"),
      deaths: int("Deaths"),
      suicides: int("Suicides"),
      headshots: int("Headshots"),
      teamKills: int("Team kills"),
      killStreak: int("Longest kill streak"),
      kpd: kpdNum(),
      hpk: fraction("Headshots per kill"),
      killsPerMinute: nullable(num("Kills per minute on the servers, two decimals; null without time")),
      assists: int("Kill assists"),
      assistedKills: int("Kills of this player others helped with"),
      shots: int("Shots"),
      hits: int("Hits"),
      accuracy: fraction("Hits per shot"),
      shotsPerKill: nullable(num("Shots per kill, two decimals; null without kills or shots")),
      rounds: int("Rounds (only rounds with a winner count)"),
      wins: int("Rounds won"),
      losses: int("Rounds lost"),
      winRatio: fraction("Rounds won per round"),
      survived: int("Rounds survived"),
      survivedShare: fraction("Rounds survived per round"),
      connectionTime: int("Time on the servers in seconds"),
      connects: nullable(int("Connections")),
      averagePing: nullable(int("Average latency in ms; null while unknown")),
      firstConnect: nullable(unix("First seen")),
      lastEvent: unix("Last seen"),
      activity: int("Activity in percent (100 = played today)", { minimum: 0, maximum: 100 }),
      careerRank: nullable(obj({ index: int("Rank index"), name: str("Rank name"), minKills: int("Kills needed"), nextAt: nullable(int("Kills for the next rank")) })),
      favoriteWeapon: nullable(obj({ code: str("Weapon code"), name: str("Weapon name"), kills: int("Kills with it") })),
      links: obj(Object.fromEntries(["weapons", "hitboxes", "maps", "teams", "actions", "opponents", "killStats", "names", "history", "awards", "ribbons"].map((k) => [k, link(`the player's ${k}`)]))),
    }),
    example: {
      id: 42,
      game: G,
      name: "ExamplePlayer",
      rank: 1,
      country: de,
      state: "Bavaria",
      city: "Munich",
      clan: { id: 3, tag: "[EX]", name: "Example Clan" },
      points: 2210,
      pointsChange: 12,
      skill: 2210,
      kills: 5321,
      deaths: 2410,
      suicides: 12,
      headshots: 1904,
      teamKills: 3,
      killStreak: 17,
      kpd: 2.21,
      hpk: 0.3578,
      killsPerMinute: 0.74,
      assists: 512,
      assistedKills: 230,
      shots: 98000,
      hits: 31000,
      accuracy: 0.3163,
      shotsPerKill: 18.42,
      rounds: 2100,
      wins: 1100,
      losses: 1000,
      winRatio: 0.5238,
      survived: 840,
      survivedShare: 0.4,
      connectionTime: 432000,
      connects: 310,
      averagePing: 35,
      firstConnect: 1735689600,
      lastEvent: 1767225600,
      activity: 98,
      careerRank: { index: 9, name: "General", minKills: 5000, nextAt: null },
      favoriteWeapon: { code: "ak47", name: "AK-47", kills: 2100 },
      links: Object.fromEntries(["weapons", "hitboxes", "maps", "teams", "actions", "opponents", "killStats", "names", "history", "awards", "ribbons"].map((k) => [k, v1(`/players/42/${k === "killStats" ? "kills" : k}`)])),
    },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/weapons",
    operationId: "listPlayerWeapons",
    tag: "Players",
    summary: "Weapons of a player",
    description: "A player's weapons with the columns of the profile's weapons table (kills, K/D, accuracy, damage per hit, shots per kill) and hits per body zone, by kills.",
    params: [idParam("player")],
    list: { item: "PlayerWeapon", sorts: ["kills", "deaths", "kpd", "headshots", "hpk", "accuracy", "shots", "hits", "damage", "name"], sort: "kills" },
    example: page(
      [{ code: "ak47", name: "AK-47", kills: 2100, deaths: 900, headshots: 830, shots: 41000, hits: 12500, damage: 380000, kpd: 2.33, hpk: 0.3952, accuracy: 0.3049, damagePerHit: 30.4, shotsPerKill: 19.52, hitboxes: zones }],
      14,
      "/players/42/weapons",
    ),
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/hitboxes",
    operationId: "getPlayerHitboxes",
    tag: "Players",
    summary: "Hitboxes of a player",
    description: "Hits per body zone over all weapons (per weapon: `/players/{id}/weapons`).",
    params: [idParam("player")],
    schema: obj({ id: int("Player ID"), total: int("Hits with a known zone"), data: arr(obj({ zone: str("Body zone", { enum: Object.keys(zones) }), hits: int("Hits"), share: fraction("Share of the hits") })) }),
    example: { id: 42, total: 12419, data: [{ zone: "head", hits: 1904, share: 0.1533 }] },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/maps",
    operationId: "listPlayerMaps",
    tag: "Players",
    summary: "Maps of a player",
    description: "A player's kills and deaths per map, from the kill events the database still holds, by kills.",
    params: [idParam("player")],
    list: { item: "PlayerMap", sorts: ["kills", "deaths", "headshots", "kpd", "name"], sort: "kills" },
    example: page([{ id: 7, name: "de_dust2", kills: 812, deaths: 390, headshots: 270, kpd: 2.08, hpk: 0.3325 }], 9, "/players/42/maps"),
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/history",
    operationId: "listPlayerHistory",
    tag: "Players",
    summary: "History of a player",
    description: "A player's days on the servers, newest first, with the columns of the website's sessions table: points and their change, time, rounds, kills, K/D, headshots, accuracy.",
    params: [idParam("player")],
    list: { item: "PlayerDay" },
    example: page(
      [{ day: "2026-01-01", points: 2210, pointsChange: 35, skill: 2210, skillChange: 35, connectionTime: 5400, rounds: 40, wins: 22, kills: 61, deaths: 30, kpd: 2.03, headshots: 20, hpk: 0.3279, killStreak: 7, shots: 1400, hits: 450, accuracy: 0.3214 }],
      210,
      "/players/42/history",
    ),
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/teams",
    operationId: "listPlayerTeams",
    tag: "Players",
    summary: "Teams of a player",
    description: "How often a player joined each team with the share of all joins (the profile's teams table), most joins first.",
    params: [idParam("player")],
    schema: obj({ id: int("Player ID"), game: str("Code of the ranking"), data: arr(obj({ id: int("Team ID"), name: str("Team name"), joined: int("Times joined"), share: fraction("Share of all joins") })) }),
    example: { id: 42, game: G, data: [{ id: 1, name: "Counter-Terrorists", joined: 61, share: 0.5214 }] },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/actions",
    operationId: "listPlayerActions",
    tag: "Players",
    summary: "Actions of a player",
    description: "The actions a player triggered (the profile's actions table): how often and the points they brought, most often first.",
    params: [idParam("player")],
    schema: obj({ id: int("Player ID"), game: str("Code of the ranking"), data: arr(obj({ id: int("Action ID"), description: nullable(str("Description")), count: int("Times triggered"), points: int("Points it brought") })) }),
    example: { id: 42, game: G, data: [{ id: 11, description: "Planted the bomb", count: 120, points: 360 }] },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/opponents",
    operationId: "getPlayerOpponents",
    tag: "Players",
    summary: "Victims and killers of a player",
    description: "The ten players this player killed most often and the ten who killed this player most often (the profile's victims and killers tables). Hidden players are left out.",
    params: [idParam("player")],
    schema: obj({ id: int("Player ID"), game: str("Code of the ranking"), victims: arr(OPPONENT), killers: arr(OPPONENT) }),
    example: { id: 42, game: G, victims: [{ id: 43, name: "OtherPlayer", ...tag, kills: 88, headshots: 30, hpk: 0.3409 }], killers: [] },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/kills",
    operationId: "getPlayerKillStats",
    tag: "Players",
    summary: "Kill statistics of a player",
    description: "Everyone this player killed at least five times (at most 50, most kills first) with the kills against and deaths by each and the other player's place in the ranking (the profile's kill statistics). Hidden players are left out, bots stay.",
    params: [idParam("player")],
    schema: obj({
      id: int("Player ID"),
      game: str("Code of the ranking"),
      minKills: int("Kills needed to be listed"),
      data: arr(
        obj({
          id: int("Player ID"),
          name: nullable(str("Name")),
          ...playerTag,
          rank: nullable(int("The other player's place in the ranking; null for bots")),
          kills: int("Kills against this player"),
          deaths: int("Deaths by this player"),
          kpd: kpdNum(),
          headshots: int("Headshots against this player"),
          hpk: fraction("Headshots per kill"),
        }),
      ),
    }),
    example: { id: 42, game: G, minKills: 5, data: [{ id: 43, name: "OtherPlayer", ...tag, rank: 12, kills: 88, deaths: 41, kpd: 2.15, headshots: 30, hpk: 0.3409 }] },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/names",
    operationId: "listPlayerNames",
    tag: "Players",
    summary: "Names of a player",
    description: "The names a player used (the profile's names table, the 20 used last), newest first.",
    params: [idParam("player")],
    schema: obj({
      id: int("Player ID"),
      game: str("Code of the ranking"),
      data: arr(obj({ name: str("Name"), connectionTime: int("Time played under this name in seconds"), kills: int("Kills"), deaths: int("Deaths"), headshots: int("Headshots"), uses: int("Times used"), lastUsed: nullable(unix("Last used")) })),
    }),
    example: { id: 42, game: G, data: [{ name: "ExamplePlayer", connectionTime: 400000, kills: 5100, deaths: 2300, headshots: 1850, uses: 290, lastUsed: 1767225600 }] },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/awards",
    operationId: "listPlayerAwards",
    tag: "Players",
    summary: "Awards of a player",
    description: "The daily awards a player won, newest first.",
    params: [idParam("player")],
    list: { item: "PlayerAward" },
    example: page([{ day: "2026-01-01", id: 5, code: "awp", name: "AWP Master", verb: "kills with awp", value: 37 }], 61, "/players/42/awards"),
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/ribbons",
    operationId: "getPlayerRibbons",
    tag: "Players",
    summary: "Rank and ribbons of a player",
    description: "A player's rank (by kills) and ribbons: per award the number of wins and the ribbon class and level reached.",
    params: [idParam("player")],
    schema: obj({
      id: int("Player ID"),
      game: str("Code of the ranking"),
      rank: nullable(obj({ index: int("Rank index"), name: str("Rank name"), minKills: int("Kills needed"), nextAt: nullable(int("Kills for the next rank")) })),
      data: arr(
        obj({
          id: int("Award ID"),
          code: str("Award code"),
          name: str("Award name"),
          verb: str("What is counted"),
          wins: int("Wins"),
          ribbon: nullable(obj({ class: int("Class index"), name: str("Class name"), level: int("Level in the class"), maxLevel: int("Levels of the class") })),
        }),
      ),
    }),
    example: { id: 42, game: G, rank: { index: 9, name: "General", minKills: 5000, nextAt: null }, data: [{ id: 5, code: "awp", name: "AWP Master", verb: "kills with awp", wins: 14, ribbon: { class: 1, name: "{LANG_SILVER}", level: 6, maxLevel: 8 } }] },
    notFound: "Unknown, hidden or bot player",
  },
];

schemas.PlaceState = { allOf: [ref("Place"), obj({ state: str("State or region (GeoIP subdivision)") })] };
schemas.PlaceCity = { allOf: [ref("Place"), obj({ city: str("City") })] };
schemas.MapRanked = {
  allOf: [
    obj({ rank: int("Position in this list") }),
    ref("Map"),
    obj({ timeShare: fraction("Share of the play time of all maps"), killShare: fraction("Share of the kills of all maps"), headshotShare: fraction("Share of the headshots of all maps") }),
  ],
};
schemas.ClanRanked = { allOf: [obj({ rank: int("Position in this list") }), ref("Clan")] };
schemas.Team = obj({
  position: int("Position in this table (most time first)"),
  id: int("Team or role ID"),
  code: str("Code"),
  name: str("Name"),
  timePlayed: int("Time played in seconds"),
  timeShare: fraction("Share of the table's time"),
  kills: int("Kills"),
  killShare: fraction("Share of the table's kills"),
  deaths: int("Deaths"),
  deathShare: fraction("Share of the table's deaths"),
  headshots: int("Headshots"),
  kpd: kpdNum(),
  wins: int("Rounds won"),
  losses: int("Rounds lost"),
  rounds: int("Rounds"),
});
schemas.TeamWithJoins = { allOf: [ref("Team"), obj({ joined: int("Times players joined the team") })] };

const errorResponse = (description: string) => ({ description, content: { "application/json": { schema: ref("Error") } } });

// Codes of rankings (hlstats_Games.code) as the routes accept them.
export const gameCodeOk = (code: string) => /^[A-Za-z0-9_-]{1,32}$/.test(code);

// The document with `game` (the first ranking of the site, see defaultGame
// in api.ts) in every example and "try it" request; a code that is no
// valid ranking code falls back to "css".
export function openApiDocument(version: string, game = "css") {
  const code = gameCodeOk(game) ? game : "css";
  return JSON.parse(JSON.stringify(buildDocument(version)).replaceAll(EXAMPLE_GAME, code));
}

function buildDocument(version: string) {
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
            content: { "application/json": { schema: obj({ version: int("API version"), docs: str("Path of this documentation"), endpoints: arr(str("")) }), example: apiIndex() } },
          },
          "429": errorResponse("Too many requests"),
        },
      },
    },
  };
  for (const e of endpoints) {
    const params = [...(e.params ?? []), ...(e.list ? [...(e.list.sorts ? sortParams(e.list.sorts, e.list.sort ?? e.list.sorts[0]) : []), ...pagingParams] : [])];
    const schema = e.list ? pageSchema(e.list.item) : e.schema;
    paths[e.path] = {
      get: {
        operationId: e.operationId,
        tags: [e.tag],
        summary: e.summary,
        description: e.description,
        parameters: params.length ? params.map(({ example, ...p }) => (example === undefined ? p : { ...p, example })) : undefined,
        responses: {
          "200": { description: "OK", content: { "application/json": { schema, example: e.example } } },
          ...(params.some((p) => p.in === "query") ? { "400": errorResponse("Invalid query parameter (the message names it and what it accepts)") } : {}),
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
        "Read-only JSON API of the gameWE statistics. It returns only what the website shows to everyone: no IP addresses, no chat, no hidden or banned players, no admin data, no hidden rankings.",
        "",
        "- **Authentication:** none.",
        "- **Rate limit:** 120 requests per minute and client address; above that the answer is `429` with a `Retry-After` header.",
        "- **Caching:** answers may be cached for 30 seconds (`Cache-Control: public, max-age=30`).",
        "- **CORS:** `Access-Control-Allow-Origin: *`, so pages on other sites can call it from the browser.",
        "- **Times** are Unix timestamps in seconds; days are `YYYY-MM-DD`.",
        `- **Lists** are paged: \`limit\` (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}) and \`page\` (from 1) or \`offset\`. The answer is \`{ data, pagination, links }\`: \`pagination\` has page, limit, offset, total and totalPages; \`links\` has self, first, prev, next and last (null at the ends). Lists with \`sort\` accept the listed fields and \`order=asc|desc\`.`,
        "- **Errors** are `{ \"error\": \"...\" }`: `400` for an invalid parameter (the message says which and what it accepts), `404` for anything unknown or not public, also for unknown paths under `/api/v1`. Unknown parameters are ignored.",
        "- **Points** are the values the website shows in its points columns (`points`, `avgPoints`, `totalPoints`, `pointsChange`); the older names `skill`, `avgSkill` and `skillChange` still carry the same values but are deprecated. Sort keys accept `points` as well as `skill`.",
        "- **Values** are computed as on the website: `kpd` is kills per death (the kills when there are no deaths), `hpk`, `accuracy` and shares are fractions (0.3125 = 31.25 %), `activity` uses the site's activity setting. Hidden and banned players are left out exactly as on the website.",
        "- **Order** is stable: equal values keep the order of their IDs.",
      ].join("\n"),
      license: { name: "GPL-3.0-or-later", identifier: "GPL-3.0-or-later" },
    },
    // Relative, so the examples show the address of the site they are read on.
    servers: [{ url: `${basePath}/api/v1` }],
    tags: [{ name: "Index" }, ...(["Rankings", "Players", "Countries, states and cities", "Clans", "Weapons", "Maps", "Awards and ranks", "Actions and teams", "Servers", "Statistics"] satisfies Tag[]).map((name) => ({ name }))],
    paths,
    components: { schemas },
  };
}

// Answer of /api/v1: the endpoints with the base path (and the defaults of
// endpoints that are not paged lists).
export function apiIndex() {
  const query = (e: Endpoint) =>
    e.list
      ? ""
      : (e.params ?? [])
          .filter((p) => p.in === "query" && (p.schema as { default?: unknown }).default !== undefined)
          .map((p) => `${p.name}=${(p.schema as { default?: unknown }).default}`)
          .join("&");
  return {
    version: 1,
    docs: `${basePath}/api`,
    endpoints: endpoints.map((e) => `${basePath}/api/v1${e.path}${query(e) ? `?${query(e)}` : ""}`),
  };
}
