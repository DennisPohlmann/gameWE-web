import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET, paged } from "./api-params.ts";
import { EVENT_PERIODS, FILTER_KINDS } from "./events-page.ts";
import { basePath } from "./base-path.ts";
import { MAP_SORTS } from "./map-table.ts";
import { PLACE_SORT_ALIASES, PLACE_SORT_DEFAULT, RANKING_SORT_ALIASES, placeSorts, rankingSorts } from "./sorts.ts";
import { rankPlayerSorts } from "./table-sort.ts";
import { ZONES } from "./zones.ts";
import { ADMIN_API_INFO, ADMIN_SECURITY_SCHEMES, ADMIN_TAGS, adminPathItems, adminSchemas } from "./openapi-admin.ts";

// OpenAPI 3.1 description of the public API (/api/v1/...), shown on /api by
// Scalar and served as /api/openapi.json. One entry per route under
// src/app/api/v1; scripts/vendor.mjs fails the build when a route has no
// entry here. The examples are made-up data on example.org; their ranking
// code is EXAMPLE_GAME, which openApiDocument replaces with the site's
// first ranking. No database access, so `npm test` can load it.

type Schema = Record<string, unknown>;
type Param = { name: string; in: "path" | "query"; description: string; schema: Schema; required?: boolean; example?: unknown };
const TAGS = [
  "Rankings",
  "Players",
  "Countries, states and cities",
  "Clans",
  "Weapons",
  "Maps",
  "Awards and ranks",
  "Actions and teams",
  "Servers",
  "Statistics",
  "Events",
  "Hall of fame",
  "Bans",
  "Player maps",
  "Search",
  "Voice server",
  "Banners",
] as const;
type Tag = (typeof TAGS)[number];
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
  // A picture (banner) instead of JSON: image/png of this size; example is
  // then the path of an example request.
  image?: { width: number; height: number };
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
    rank: nullable(int("Place in the whole ranking by points: 1 + players with more points (equal points share a place), also in a filtered or re-sorted list; null for inactive players (view=inactive), who have no place")),
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
  Hitboxes: obj(Object.fromEntries(ZONES.map((z) => [z, int(z === "neck" ? "Hits on neck (Counter-Strike 2 only, else 0)" : `Hits on ${z}`)]))),
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
const zones = { head: 1904, neck: 0, chest: 5120, stomach: 2310, leftarm: 880, rightarm: 910, leftleg: 640, rightleg: 655 };
const days = [
  { day: "2026-01-01", players: 31, kills: 4210, headshots: 1388 },
  { day: "2026-01-02", players: 28, kills: 3987, headshots: 1290 },
];

// Sort keys as the routes accept them; points (and its relatives) are other
// names of skill, as the website calls the column.
const PLAYER_SORTS = [...Object.keys(rankingSorts), ...Object.keys(RANKING_SORT_ALIASES)];
const PLACE_SORTS = [...Object.keys(placeSorts), ...Object.keys(PLACE_SORT_ALIASES)];
const CLAN_PARTS = ["history", "radar", "weapons", "maps", "map", "events"];
const PLAYER_PARTS = ["weapons", "hitboxes", "maps", "teams", "actions", "opponents", "killStats", "names", "history", "awards", "ribbons", "events", "radar", "banner"];
const SESSION_SORTS = ["date", "change", "points", "time", "rounds", "wins", "kills", "deaths", "kpd", "streak", "hs", "hpk", "acc"];
const loadPoint = { time: 1767225600, players: 12, min: 10, max: 14, map: "de_dust2", uptime: 86400 };
const CLAN_SORTS = ["skill", "members", "kills", "deaths", "headshots", "kpd", "hpk", "time", "activity", "tag", "points", "avgPoints"];

const ban = { source: "sourcebans", reason: "Cheating", bannedAt: 1767225600, dateText: null, length: "Permanent", endsAt: null };

// Event types of a player's events page (EVENT_KINDS in history.ts) and of
// the type filter of a ranking's events page.
const PLAYER_EVENT_TYPES = ["connect", "entry", "disconnect", "team", "role", "name", "action", "playeraction", "teambonus", "kill", "death", "suicide", "teamkill"];
const FILTER_EVENT_TYPES = FILTER_KINDS;
const periodQuery: Param = { name: "period", in: "query", description: "The last hour, 24 hours or 7 days", schema: str("", { enum: Object.keys(EVENT_PERIODS), default: "24h" }) };
const styleQuery: Param = { name: "style", in: "query", description: "Design template of the banner (an id of /banners/styles); without it, or with an unknown one, the active skin", schema: str("", { pattern: "^[a-z0-9][a-z0-9_-]{0,31}$" }) };
const activityDays = (def: number): Param => ({ name: "days", in: "query", description: "Days back", schema: int("", { enum: [1, 7, 14, 30], default: def }) });
const activityPoint = { time: 1767225600, players: 12.5, servers: 2, kills: 41, headshots: 13 };
const marker = { id: 42, name: "ExamplePlayer", country: de, city: "Munich", lat: 48.14, lng: 11.58, rank: 1, points: 2210, kills: 5321, deaths: 2410, kpd: 2.21, lastEvent: 1767225600, server: null, inactive: false };
const mapServer = { id: 1, name: "Example Public #1", address: "cs.example.org:27015", map: "de_dust2", city: "Frankfurt am Main", country: de, lat: 50.11, lng: 8.68, online: true, uptime: 86400, vac: true };
const radar = {
  days: 14,
  activeDays: 9,
  comparedPlayers: 118,
  axes: [
    { axis: "kpd", value: 1.84, average: 1.02, relative: 1.8039, noData: false },
    { axis: "kpm", value: 0.71, average: 0.52, relative: 1.3654, noData: false },
    { axis: "survived", value: 0.41, average: 0.38, relative: 1.0789, noData: false },
    { axis: "wins", value: 0.53, average: 0.5, relative: 1.06, noData: false },
  ],
};
const event = {
  time: 1767225600,
  type: "kill",
  player: { id: 42, name: "ExamplePlayer", ...tag },
  other: { id: 43, name: "OtherPlayer", ...tag },
  weapon: { code: "ak47", name: "AK-47" },
  headshot: true,
  action: null,
  team: null,
  oldName: null,
  newName: null,
  map: "de_dust2",
  server: "Example Public #1",
};
const hallEntry = {
  place: 1,
  id: 42,
  name: "ExamplePlayer",
  currentName: "ExamplePlayer",
  country: de,
  points: 2210,
  kills: 812,
  deaths: 410,
  kpd: 1.98,
  headshots: 270,
  hpk: 0.3325,
  accuracy: 0.3011,
  killStreak: 14,
  connectionTime: 98765,
  favoriteWeapon: { code: "ak47", name: "AK-47" },
  rankName: "General",
};

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
      { name: "view", in: "query", description: "ranked: the ranking; inactive: the players the collector moved out of the ranking for inactivity (the website's Inactive players), by last seen, without a place (rank null) and without country, state or city filter", schema: str("", { enum: ["ranked", "inactive"], default: "ranked" }) },
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
    description:
      "Clans with at least two ranked members, by average points. The country is the most common one among the members. `view=inactive`: the website's inactive clans (at least two members, fewer than two of them still active), by last seen, with the numbers of all members.",
    params: [gameParam, { name: "view", in: "query", description: "ranked (default) or inactive", schema: str("", { enum: ["ranked", "inactive"], default: "ranked" }) }],
    list: { item: "ClanRanked", sorts: CLAN_SORTS, sort: "skill" },
    example: page([{ rank: 1, ...clan }], 12, `/rankings/${G}/clans`),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}",
    operationId: "getClan",
    tag: "Clans",
    summary: "One clan",
    description:
      "One clan with the totals of its ranked members, where its members come from (active and inactive ones, by country) and the links to the other parts of the clan page.",
    params: [gameParam, idParam("clan", 3)],
    schema: {
      allOf: [
        obj({ game: str("Code of the ranking") }),
        ref("Clan"),
        obj({
          inactive: bool("Fewer than two active members: an inactive clan (the website then shows the numbers of all members)"),
          inactiveMembers: int("Members the collector moved out of the ranking for inactivity"),
          origins: arr(obj({ country: ref("Country"), members: int("Members from this country") })),
          membersUrl: link("its members"),
          links: obj(Object.fromEntries(CLAN_PARTS.map((k) => [k, link(`the clan's ${k}`)]))),
        }),
      ],
    },
    example: {
      game: G,
      ...clan,
      inactive: false,
      inactiveMembers: 2,
      origins: [{ country: de, members: 7 }],
      membersUrl: v1(`/rankings/${G}/clans/3/members`),
      links: Object.fromEntries(CLAN_PARTS.map((k) => [k, v1(`/rankings/${G}/clans/3/${k}`)])),
    },
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}/members",
    operationId: "listClanMembers",
    tag: "Clans",
    summary: "Members of a clan",
    description:
      "The ranked members of a clan (the website's clan page); `position` numbers the rows, `rank` is the place in the whole ranking. Sort fields as in `/players`. `view=inactive`: the members the collector moved out of the ranking, by last seen, without a place.",
    params: [gameParam, idParam("clan", 3), { name: "view", in: "query", description: "ranked (default) or inactive", schema: str("", { enum: ["ranked", "inactive"], default: "ranked" }) }],
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
      data: arr(ref("LoadPoint")),
    }),
    example: { game: G, id: 1, hours: 24, maxPlayers: 24, data: [loadPoint] },
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
    description:
      "Totals over all rankings, the start page's general statistics (its five cards: players of both player tables without bots, clans and the rankings with clans, servers and those with players, players online, kills with the latest one, headshots) and the activity per day (players active in any ranking, kills, headshots, clans with an active member), oldest day first.",
    params: [daysQuery(30, 365, "Days back, today included")],
    schema: obj({
      totals: obj({ rankings: int("Rankings with servers"), servers: int("Servers"), players: int("Players"), clans: int("Clans"), kills: int("Kills"), deaths: int("Deaths"), headshots: int("Headshots") }),
      general: obj({
        players: int("Players of all visible rankings, also hidden, banned and inactive ones (counted, not listed), without bots"),
        playersOnline: int("Players online now, without bots"),
        clans: int("Clans of the visible rankings"),
        clanRankings: int("Rankings with clans"),
        servers: int("Servers of the visible rankings"),
        serversActive: int("Servers with players now"),
        kills: int("Kills of both player tables"),
        lastKill: nullable(unix("Latest kill")),
        headshots: int("Headshots of both player tables"),
      }),
      days: arr({ allOf: [ref("DayActivity"), obj({ activeClans: int("Clans with an active member that day") })] }),
    }),
    example: {
      totals: { rankings: 2, servers: 3, players: 2345, clans: 21, kills: 987654, deaths: 965432, headshots: 312345 },
      general: { players: 2790, playersOnline: 14, clans: 21, clanRankings: 2, servers: 3, serversActive: 2, kills: 1043210, lastKill: 1767225590, headshots: 330112 },
      days: days.map((d) => ({ ...d, activeClans: 4 })),
    },
  },
  // ------------------------------------------------------------ players
  {
    path: "/players/{id}",
    operationId: "getPlayer",
    tag: "Players",
    summary: "One player",
    description:
      "Public summary of one player with the values of the website's profile (player profile and summary) and the hall of fame stars (null where the ranking shows no hall of fame). A player banned in the ranking keeps the profile with the ban notice, as on the website (`banned`, `bans`, no `rank`); like there, they are not in the lists. Hidden players, bots without a profile and players of hidden rankings answer 404, also on all `/players/{id}/...` endpoints. No Steam ID, Steam profile, IP address or chat.",
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
      stars: nullable(obj({ gold: int("First places in the hall of fame"), silver: int("Second places"), bronze: int("Third places") })),
      banned: bool("Banned: in the ranking (hidden as banned) or with a running ban, as the profile's ban notice and badges"),
      bans: arr(ref("Ban")),
      links: obj(Object.fromEntries(PLAYER_PARTS.map((k) => [k, link(`the player's ${k}`)]))),
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
      stars: { gold: 1, silver: 0, bronze: 2 },
      banned: false,
      bans: [],
      links: Object.fromEntries(PLAYER_PARTS.map((k) => [k, v1(`/players/42/${k === "killStats" ? "kills" : k}`)])),
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
    description:
      "A player's days on the servers, newest first, with the columns of the website's sessions table: points and their change, time, rounds, kills, K/D, headshots, accuracy. Sort fields as the table: `date`, `change`, `points`, `time`, `rounds`, `wins`, `kills`, `deaths`, `kpd`, `streak`, `hs`, `hpk`, `acc`; another order than newest first covers the last 5000 days.",
    params: [idParam("player")],
    list: { item: "PlayerDay", sorts: SESSION_SORTS, sort: "date" },
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
    description: "The daily awards a player won, newest first (the website's awards page); `sort=award` orders by the award's name.",
    params: [idParam("player")],
    list: { item: "PlayerAward", sorts: ["date", "award"], sort: "date" },
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
  {
    path: "/players/{id}/events",
    operationId: "listPlayerEvents",
    tag: "Players",
    summary: "Events of a player",
    description:
      "The player's events page: connects, entries, leaves, team, role and name changes, actions, kills, deaths, suicides and team kills, newest first (`order=asc`: oldest first), optionally one `type`. Events with a hidden player on the other side are left out; never chat or addresses. Lists end after 10000 events.",
    params: [
      idParam("player"),
      { name: "type", in: "query", description: "Only this type", schema: str("", { enum: [...PLAYER_EVENT_TYPES] }) },
      { name: "order", in: "query", description: "desc (newest first, default) or asc", schema: str("", { enum: ["desc", "asc"], default: "desc" }) },
    ],
    list: { item: "PlayerEvent" },
    example: page([{ time: 1767225600, type: "kill", other: { id: 43, name: "OtherPlayer", ...tag }, weapon: { code: "ak47", name: "AK-47" }, headshot: true, action: null, team: null, oldName: null, newName: null, map: "de_dust2" }], 5210, "/players/42/events"),
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/radar",
    operationId: "getPlayerRadar",
    tag: "Players",
    summary: "Radar of a player",
    description:
      "The radar of the profile: the player's last 14 days (`kpd` kills per death, `kpm` kills per minute, `assists` per kill, rounds `survived` and `wins` per round) against all players of the ranking active in them. `relative` is the player's value divided by the average (1 = average); assists only where the game records them.",
    params: [idParam("player")],
    schema: { allOf: [obj({ id: int("Player ID"), game: str("Code of the ranking") }), ref("Radar")] },
    example: { id: 42, game: G, ...radar },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/banner",
    operationId: "getPlayerBanner",
    tag: "Banners",
    summary: "Player banner",
    description:
      "The player banner (forum signature, 400×100 PNG) of the profile: rank insignia with the progress to the next rank, Steam avatar, name, place and key numbers. The same picture as `/banner/{game}/player/{id}.png` on the website; `style` picks a design template (`/banners/styles`), without it the active skin.",
    params: [idParam("player"), styleQuery],
    image: { width: 400, height: 100 },
    example: v1("/players/42/banner"),
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/rankings/{game}/servers/{id}/banner",
    operationId: "getServerBanner",
    tag: "Banners",
    summary: "Server banner",
    description:
      "The server banner (560×95 PNG) of the server and misc pages: name with flag, address, port, status, players with a pie, map and the players of the last 24 hours. The same picture as `/banner/{game}/server/{id}.png` on the website; `style` picks a design template.",
    params: [gameParam, idParam("server", 1), styleQuery],
    image: { width: 560, height: 95 },
    example: v1(`/rankings/${G}/servers/1/banner`),
    notFound: "Unknown ranking or server, or the server belongs to another ranking",
  },
  {
    path: "/voice/teamspeak/banner",
    operationId: "getTeamSpeakBanner",
    tag: "Banners",
    summary: "TeamSpeak banner",
    description:
      "The TeamSpeak banner (560×95 PNG) of the TeamSpeak page: name with flag, address, status, users online of the slots, channels, uptime and server type, live from the ServerQuery. The same picture as `/banner/teamspeak.png` on the website; `style` picks a design template.",
    params: [styleQuery],
    image: { width: 560, height: 95 },
    example: v1("/voice/teamspeak/banner"),
    notFound: "TeamSpeak is not the voice server of this site",
  },
  {
    path: "/banners/styles",
    operationId: "listBannerStyles",
    tag: "Banners",
    summary: "Banner styles",
    description: "The styles every banner takes as `style` besides the default (the active skin): one per design template, as in the website's banner code box.",
    schema: obj({ data: arr(obj({ id: str("Value of style"), name: obj({ en: str("Name in English"), de: str("Name in German") }) })) }),
    example: { data: [{ id: "dark", name: { en: "Dark", de: "Dunkel" } }] },
  },
  {
    path: "/voice",
    operationId: "getVoiceBox",
    tag: "Voice server",
    summary: "Voice server box",
    description:
      "The voice server box of the start page: the TeamSpeak server (live from its ServerQuery, kept for a minute) or the Discord server (its public widget, kept for five minutes). Both null when the site has no voice server.",
    schema: obj({
      teamspeak: nullable(
        obj({
          name: str("Server name"),
          type: str("Server type, e.g. TeamSpeak 3"),
          country: nullable(str("ISO code of the flag the site shows; null without one")),
          address: str("Address to connect to"),
          link: str("ts3server:// link"),
          passwordProtected: bool("The server needs a password"),
          password: nullable(str("The server password, only while the admin allows showing it (Admin → Settings → Voice server: Allow showing the TeamSpeak password, default off); else null")),
          clients: nullable(int("Users online; null while the query fails")),
          maxClients: nullable(int("Slots")),
          channels: nullable(int("Channels")),
          uptime: nullable(int("Seconds since the server started")),
          detailsUrl: link("the TeamSpeak details"),
          bannerUrl: link("the TeamSpeak banner"),
        }),
      ),
      discord: nullable(obj({ name: str("Server name"), invite: nullable(str("Invite link")), online: nullable(int("Members online; null when unknown")) })),
    }),
    example: {
      teamspeak: {
        name: "Example TeamSpeak",
        type: "TeamSpeak 3",
        country: "DE",
        address: "ts.example.org",
        link: "ts3server://ts.example.org",
        passwordProtected: true,
        password: null,
        clients: 5,
        maxClients: 32,
        channels: 12,
        uptime: 864000,
        detailsUrl: v1("/voice/teamspeak"),
        bannerUrl: v1("/voice/teamspeak/banner"),
      },
      discord: null,
    },
  },
  {
    path: "/voice/teamspeak",
    operationId: "getTeamSpeak",
    tag: "Voice server",
    summary: "TeamSpeak server",
    description:
      "The TeamSpeak page: server data, traffic, the welcome message and the channel tree with the people online (names only while the admin shows them; `clientCount` always). Live from the ServerQuery, kept for a minute; `online` false and `info` null while the query fails.",
    schema: obj({
      name: str("Server name"),
      type: str("Server type"),
      country: nullable(str("ISO code of the flag")),
      address: str("Address to connect to"),
      link: str("ts3server:// link"),
      passwordProtected: bool("The server needs a password"),
      password: nullable(str("The server password, only while the admin allows showing it (default off); else null")),
      online: bool("The query answered"),
      clients: nullable(int("Users online")),
      maxClients: nullable(int("Slots")),
      channelCount: nullable(int("Channels")),
      showClients: bool("The names of the people online are shown"),
      info: nullable(
        obj({
          uptime: nullable(int("Seconds since the server started")),
          created: nullable(unix("Server created")),
          version: nullable(str("Server version")),
          os: nullable(str("Linux, Windows, FreeBSD or macOS")),
          clientConnections: nullable(int("Client connections so far")),
          queryConnections: nullable(int("Query connections so far")),
          securityLevel: nullable(int("Identity security level needed")),
          ping: nullable(num("Average ping in ms")),
          packetLoss: nullable(num("Packet loss, a fraction")),
          bandwidthIn: nullable(int("Bytes received in the last second")),
          bandwidthOut: nullable(int("Bytes sent in the last second")),
          bytesIn: nullable(int("Bytes received in total")),
          bytesOut: nullable(int("Bytes sent in total")),
          hostBannerUrl: nullable(str("The server's own host banner (http or https)")),
          welcome: nullable(str("Welcome message as plain text")),
        }),
      ),
      channels: arr(ref("VoiceChannel")),
      bannerUrl: link("the TeamSpeak banner"),
    }),
    example: {
      name: "Example TeamSpeak",
      type: "TeamSpeak 3",
      country: "DE",
      address: "ts.example.org",
      link: "ts3server://ts.example.org",
      passwordProtected: true,
      password: "join-example",
      online: true,
      clients: 2,
      maxClients: 32,
      channelCount: 2,
      showClients: true,
      info: {
        uptime: 864000,
        created: 1735689600,
        version: "3.13.7 [Build: 1655727713]",
        os: "Linux",
        clientConnections: 4321,
        queryConnections: 98765,
        securityLevel: 8,
        ping: 21.5,
        packetLoss: 0,
        bandwidthIn: 1200,
        bandwidthOut: 3400,
        bytesIn: 123456789,
        bytesOut: 987654321,
        hostBannerUrl: null,
        welcome: "Welcome!",
      },
      channels: [{ id: 1, name: "Lobby", spacer: null, topic: null, password: false, clientCount: 2, clients: [{ name: "ExamplePlayer", away: false, muted: false, deaf: false, country: "DE" }], children: [] }],
      bannerUrl: v1("/voice/teamspeak/banner"),
    },
    notFound: "TeamSpeak is not the voice server of this site",
  },
  {
    path: "/search/players",
    operationId: "searchPlayers",
    tag: "Search",
    summary: "Search players",
    description:
      "The website's search over all rankings (or one with `game`): every name a player used (`in=names`, at least 2 characters; `alias` is the used name that matched when it is not the current one), or a Steam ID in any of its forms (`in=steamid`, exact match only). Hidden and banned players are not found. At most 100 hits, best points first; `url` is null for bots without a profile.",
    params: [
      { name: "q", in: "query", required: true, description: "Text to search for", schema: str("", { minLength: 1, maxLength: 64 }), example: "Example" },
      { name: "in", in: "query", description: "names (default) or steamid", schema: str("", { enum: ["names", "steamid"], default: "names" }) },
      { name: "game", in: "query", description: "Only this ranking", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: G },
    ],
    list: { item: "SearchPlayer" },
    example: page([{ position: 1, game: G, id: 42, name: "ExamplePlayer", alias: null, country: de, bot: false, points: 2210, kills: 5321, deaths: 2410, kpd: 2.21, lastEvent: 1767225600, url: v1("/players/42") }], 1, "/search/players", { q: "Example" }),
  },
  {
    path: "/search/clans",
    operationId: "searchClans",
    tag: "Search",
    summary: "Search clans",
    description: "The website's clan search over all rankings (or one with `game`): part of the tag or the name, at least 2 characters. Clans without a ranked member are not found. At most 100 hits, most members first.",
    params: [
      { name: "q", in: "query", required: true, description: "Part of the tag or the name", schema: str("", { minLength: 2, maxLength: 64 }), example: "EX" },
      { name: "game", in: "query", description: "Only this ranking", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: G },
    ],
    list: { item: "SearchClan" },
    example: page([{ position: 1, game: G, id: 3, tag: "[EX]", name: "Example Clan", members: 8, avgPoints: 1650, url: v1(`/rankings/${G}/clans/3`) }], 1, "/search/clans", { q: "EX" }),
  },
  {
    path: "/points",
    operationId: "getPoints",
    tag: "Statistics",
    summary: "Point rules",
    description:
      "The point rules of the help page: the collector's point settings, and per ranking whether it ranks bots and whether kills of bots give points. Bonuses of actions: `/rankings/{game}/actions`; weapon modifiers: `/rankings/{game}/weapons`.",
    schema: obj({
      startPoints: int("Points of a new player"),
      killPoints: int("Base points of a kill (before the weapon modifier and the points difference)"),
      headshotBonus: int("Extra points of a headshot"),
      suicidePenalty: int("Points lost by a suicide"),
      teamkillPenalty: int("Points lost by a team kill"),
      rankings: arr(obj({ game: str("Code of the ranking"), botsRanked: bool("Bots are ranked and have profiles"), botKillPoints: bool("Kills of bots give points") })),
    }),
    example: { startPoints: 1000, killPoints: 5, headshotBonus: 0, suicidePenalty: 5, teamkillPenalty: 10, rankings: [{ game: G, botsRanked: false, botKillPoints: true }] },
  },
  {
    path: "/activity",
    operationId: "getActivity",
    tag: "Statistics",
    summary: "Activity per 15 minutes",
    description:
      "Players online, servers with players, kills and headshots per 15 minutes over all rankings, oldest first: the lines of the start page's general statistics and its load chart. `players` and `servers` are null where the collector recorded no load (it samples every 10 minutes).",
    params: [activityDays(30)],
    schema: obj({ days: int("Days back"), step: int("Seconds per entry (900)"), data: arr(ref("ActivityPoint")) }),
    example: { days: 30, step: 900, data: [activityPoint] },
  },
  {
    path: "/rankings/{game}/activity",
    operationId: "getRankingActivity",
    tag: "Statistics",
    summary: "Activity of a ranking per 15 minutes",
    description: "Players online, servers with players, kills and headshots of one ranking per 15 minutes, oldest first: the trend of the ranking's start page (14 days).",
    params: [gameParam, activityDays(14)],
    schema: obj({ game: str("Code of the ranking"), days: int("Days back"), step: int("Seconds per entry (900)"), data: arr(ref("ActivityPoint")) }),
    example: { game: G, days: 14, step: 900, data: [activityPoint] },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/load",
    operationId: "getRankingLoad",
    tag: "Servers",
    summary: "Load of all servers",
    description: "The load of every server of a ranking in one answer (the graph of all servers on the ranking's start page): one point per server and 10 minutes, oldest first, servers in the site's order.",
    params: [gameParam, { name: "hours", in: "query", description: "Hours back", schema: int("", { minimum: 1, maximum: 168, default: 24 }) }],
    schema: obj({ game: str("Code of the ranking"), hours: int("Hours back"), data: arr(obj({ id: int("Server ID"), name: str("Server name"), maxPlayers: int("Slots now"), load: arr(ref("LoadPoint")) })) }),
    example: { game: G, hours: 24, data: [{ id: 1, name: "Example Public #1", maxPlayers: 24, load: [loadPoint] }] },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/map/live",
    operationId: "getLiveMap",
    tag: "Player maps",
    summary: "Live map",
    description:
      "The live map of the ranking's start page: the players online (not hidden ones, no bots) at the GeoIP city point of their connection, with the server they are on, and the ranking's servers at the point of their address. Only city points, never an address. 404 while the site shows no live map.",
    params: [gameParam],
    schema: obj({ game: str("Code of the ranking"), players: arr(ref("MapMarker")), servers: arr(ref("MapServer")) }),
    example: { game: G, players: [{ ...marker, server: { id: 1, name: "Example Public #1" } }], servers: [mapServer] },
    notFound: "Unknown ranking, or the site shows no live map",
  },
  {
    path: "/rankings/{game}/map/players",
    operationId: "getPlayerMap",
    tag: "Player maps",
    summary: "Player map",
    description:
      "The player map of the players page: the best players with a known place (`show=top`: the top 10 with the server they are on now; `show=all`: up to 1000), optionally of one country, state or city, each at the GeoIP city point. 404 while the site shows no player map.",
    params: [
      gameParam,
      { name: "show", in: "query", description: "top (default, 10 players) or all (up to 1000)", schema: str("", { enum: ["top", "all"], default: "top" }) },
      countryQuery,
      { name: "state", in: "query", description: "Only this state or region (exact name, any case)", schema: str("", { maxLength: 80 }) },
      { name: "city", in: "query", description: "Only this city (exact name, any case)", schema: str("", { maxLength: 80 }) },
    ],
    schema: obj({ game: str("Code of the ranking"), show: str("top or all"), players: arr(ref("MapMarker")) }),
    example: { game: G, show: "top", players: [marker] },
    notFound: "Unknown ranking, or the site shows no player map",
  },
  {
    path: "/rankings/{game}/clans/{id}/map",
    operationId: "getClanMap",
    tag: "Player maps",
    summary: "Clan map",
    description: "The map of the clan page: every member with a known place, active ones first (with their place in the ranking), then the inactive ones (`inactive` true, no rank). 404 while the site shows no player map.",
    params: [gameParam, idParam("clan", 3)],
    schema: obj({ game: str("Code of the ranking"), id: int("Clan ID"), players: arr(ref("MapMarker")) }),
    example: { game: G, id: 3, players: [marker] },
    notFound: "Unknown clan, the clan belongs to another ranking, or the site shows no player map",
  },
  {
    path: "/rankings/{game}/clans/{id}/history",
    operationId: "getClanHistory",
    tag: "Clans",
    summary: "History of a clan",
    description:
      "The members' days added up (the clan page's summary and its lines): one entry per day, oldest first, days without play 0. The members are the active ones, or all of them for an inactive clan.",
    params: [gameParam, idParam("clan", 3), daysQuery(30, 90, "Days back, today included")],
    schema: obj({ game: str("Code of the ranking"), id: int("Clan ID"), days: int("Days back"), data: arr(ref("ClanDay")) }),
    example: {
      game: G,
      id: 3,
      days: 30,
      data: [{ day: "2026-01-01", connectionTime: 21600, rounds: 160, wins: 88, survived: 61, kills: 240, deaths: 190, kpd: 1.26, headshots: 80, hpk: 0.3333, assists: 31, shots: 5400, hits: 1700, accuracy: 0.3148, pointsChange: 54 }],
    },
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}/radar",
    operationId: "getClanRadar",
    tag: "Clans",
    summary: "Radar of a clan",
    description: "The radar of the clan page: the members' last 14 days together against all players of the ranking active in them, as `/players/{id}/radar`.",
    params: [gameParam, idParam("clan", 3)],
    schema: { allOf: [obj({ game: str("Code of the ranking"), id: int("Clan ID") }), ref("Radar")] },
    example: { game: G, id: 3, ...radar },
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}/weapons",
    operationId: "listClanWeapons",
    tag: "Clans",
    summary: "Weapons of a clan",
    description: "The members' weapons added up (the clan page's weapon tables and hitboxes), with the columns of `/players/{id}/weapons`.",
    params: [gameParam, idParam("clan", 3)],
    list: { item: "PlayerWeapon", sorts: ["kills", "deaths", "kpd", "headshots", "hpk", "accuracy", "shots", "hits", "damage", "name"], sort: "kills" },
    example: page(
      [{ code: "ak47", name: "AK-47", kills: 9100, deaths: 4900, headshots: 3300, shots: 181000, hits: 54000, damage: 1620000, kpd: 1.86, hpk: 0.3626, accuracy: 0.2983, damagePerHit: 30, shotsPerKill: 19.89, hitboxes: zones }],
      18,
      `/rankings/${G}/clans/3/weapons`,
    ),
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}/maps",
    operationId: "listClanMaps",
    tag: "Clans",
    summary: "Maps of a clan",
    description: "The members' kills and deaths per map, the 15 maps with the most kills (the clan page's map table, from the kill events the database still holds; a kill between two members counts both ways).",
    params: [gameParam, idParam("clan", 3)],
    schema: obj({ game: str("Code of the ranking"), id: int("Clan ID"), data: arr({ allOf: [ref("PlayerMap"), obj({ url: link("the map") })] }) }),
    example: { game: G, id: 3, data: [{ id: 7, name: "de_dust2", kills: 3120, deaths: 2410, headshots: 1010, kpd: 1.29, hpk: 0.3237, url: v1(`/rankings/${G}/maps/7`) }] },
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}/events",
    operationId: "listClanEvents",
    tag: "Events",
    summary: "Latest events of a clan",
    description: "The latest events of the clan page: kills, deaths and actions of the active members, newest first, at most 25. Events with a hidden player are left out. 404 while the site shows no player event boxes.",
    params: [gameParam, idParam("clan", 3)],
    schema: obj({ game: str("Code of the ranking"), id: int("Clan ID"), data: arr(ref("Event")) }),
    example: { game: G, id: 3, data: [event] },
    notFound: "Unknown clan, the clan belongs to another ranking, or the site shows no player event boxes",
  },
  {
    path: "/rankings/{game}/events",
    operationId: "listEvents",
    tag: "Events",
    summary: "Events of a ranking",
    description:
      "The events page of a ranking: connects, entries, leaves, team, role and name changes, actions, kills, suicides and team kills of the last hour, 24 hours or 7 days, newest first (`order=asc`: oldest first), with its type filter (`action` covers actions on players too). Events with a hidden or banned player are left out; never chat or addresses. A list ends after 5000 events, as on the website. 404 while the site has no events page.",
    params: [gameParam, periodQuery, { name: "type", in: "query", description: "Only this type", schema: str("", { enum: [...FILTER_EVENT_TYPES] }) }, { name: "order", in: "query", description: "desc (newest first, default) or asc", schema: str("", { enum: ["desc", "asc"], default: "desc" }) }],
    list: { item: "Event" },
    example: page([event], 1234, `/rankings/${G}/events`),
    notFound: "Unknown ranking, or the site has no events page",
  },
  {
    path: "/rankings/{game}/events/stats",
    operationId: "getEventStats",
    tag: "Events",
    summary: "Event counts of a ranking",
    description:
      "The chart and the share table of the events page: the events of each type over the period with its share of all (most first), and per group of types the events per chart step (5 minutes for 1h, else 1 hour) from `from` on.",
    params: [gameParam, periodQuery],
    schema: obj({
      game: str("Code of the ranking"),
      period: str("1h, 24h or 7d"),
      from: unix("Start of the first chart step"),
      step: int("Seconds per chart step"),
      total: int("Events in the period"),
      types: arr(obj({ type: str("Event type"), count: int("Events"), share: num("Share of all events, a fraction") })),
      groups: arr(obj({ group: str("kills, actions, joins, changes or deaths"), types: arr(str("Types in the group")), counts: arr(int("Events in the step")) })),
    }),
    example: {
      game: G,
      period: "24h",
      from: 1767139200,
      step: 3600,
      total: 1234,
      types: [{ type: "kill", count: 900, share: 0.7293 }],
      groups: [{ group: "kills", types: ["kill"], counts: [40, 37] }],
    },
    notFound: "Unknown ranking, or the site has no events page",
  },
  {
    path: "/rankings/{game}/bans",
    operationId: "listBans",
    tag: "Bans",
    summary: "Banned players",
    description:
      "The bans page of a ranking: every banned player once (also players banned in the ranking; hidden players never), with each running ban: recorded by the collector from the server logs (`sourcemod`, `amx`, `engine`, `sourcebans`), from the SourceBans list (`sourcebans`, where the site has its address) and VAC or game bans from Steam (`vac`, with a Steam Web API key; the 1000 most recently active players are checked). Like the page in two tabs: `view=ranked` (default) the banned players still in the ranking, `view=inactive` those the collector moved out of the ranking for inactivity (the 1000 most recently seen of them are checked for Steam bans). Expired and lifted bans are not listed. Newest ban first, at most 500, as on the website; `length` in English. Sort fields: `date`, `name`, `type`, `reason`, `kpd`, `hpk`, `acc`. No IP addresses.",
    params: [gameParam, { name: "view", in: "query", description: "ranked (default) or inactive", schema: str("", { enum: ["ranked", "inactive"], default: "ranked" }) }],
    list: { item: "BannedPlayer", sorts: ["date", "name", "type", "reason", "kpd", "hpk", "acc"], sort: "date" },
    example: page(
      [{ position: 1, id: 66, name: "BannedExample", country: de, bannedAt: 1767225600, dateText: null, reason: "Cheating", bans: [{ ...ban, source: "vac", reason: "1× VAC", length: null }, ban], kills: 350, deaths: 150, kpd: 2.33, hpk: 0.41, accuracy: 0.3812, url: v1("/players/66") }],
      12,
      `/rankings/${G}/bans`,
    ),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/hall-of-fame",
    operationId: "listHallOfFame",
    tag: "Hall of fame",
    summary: "Hall of fame",
    description:
      "The hall of fame of a ranking: per reset period, newest first, the first three players with their values at the end of the period (name as then; `currentName` now). Removed entries and players hidden now are left out and the ones below move up. 404 while the ranking shows no hall of fame.",
    params: [gameParam],
    list: { item: "HallPeriod" },
    example: page([{ unit: "month", every: 1, start: "2026-09-01", end: "2026-09-30", resetAt: 1759276800, players: 312, places: [hallEntry, null, null] }], 6, `/rankings/${G}/hall-of-fame`),
    notFound: "Unknown ranking, or it shows no hall of fame",
  },
  {
    path: "/rankings/{game}/hall-of-fame/stars",
    operationId: "listHallOfFameStars",
    tag: "Hall of fame",
    summary: "Hall of fame stars",
    description: "The star table of the hall of fame: per player gold (first places), silver and bronze; most gold first, then silver, bronze and the latest period.",
    params: [gameParam],
    list: { item: "HallStars" },
    example: page([{ position: 1, id: 42, name: "ExamplePlayer", country: de, gold: 2, silver: 1, bronze: 0, lastPeriod: "2026-09-01" }], 9, `/rankings/${G}/hall-of-fame/stars`),
    notFound: "Unknown ranking, or it shows no hall of fame",
  },
  {
    path: "/rankings/{game}/misc",
    operationId: "getMiscStats",
    tag: "Statistics",
    summary: "Misc statistics",
    description:
      "The misc page of a ranking: countries of the ranked players (null: unknown), connects and play time per weekday over the last year, connect methods (where the collector records them; `name` in English) and connects per day of the last 30 days.",
    params: [gameParam],
    schema: obj({
      game: str("Code of the ranking"),
      countries: arr(obj({ country: nullable(ref("Country")), players: int("Ranked players") })),
      weekdays: arr(obj({ weekday: str("monday to sunday"), connects: int("Connects"), connectionTime: int("Time played in seconds") })),
      connectTypes: arr(obj({ type: int("Connect method"), name: nullable(str("Name of the method")), connects: int("Players") })),
      connectsPerDay: arr(obj({ day: str("Day (YYYY-MM-DD)", { format: "date" }), connects: int("Connects") })),
    }),
    example: {
      game: G,
      countries: [{ country: de, players: 412 }],
      weekdays: [{ weekday: "monday", connects: 812, connectionTime: 1234567 }],
      connectTypes: [{ type: 6, name: "Steam", connects: 120 }],
      connectsPerDay: [{ day: "2026-01-01", connects: 61 }],
    },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/maps/{id}/heatmap",
    operationId: "getMapHeatmap",
    tag: "Maps",
    summary: "Heatmap of a map",
    description:
      "The heatmap of the map page: where killers stood (with the headshot flag) and where players died, the newest 3000 positions of each, in game units (x to the right, y up; `bounds` frames them). No players, only positions. Counter-Strike 2 maps with two levels (`levels` not null) take `level=upper` or `lower`.",
    params: [gameParam, idParam("map", 7), { name: "level", in: "query", description: "upper or lower (maps with two levels only)", schema: str("", { enum: ["upper", "lower"] }) }],
    schema: obj({
      game: str("Code of the ranking"),
      id: int("Map ID"),
      map: str("Map name"),
      levels: nullable(obj({ split: int("Height (game units) between the levels"), level: nullable(str("The level shown; null: both")) })),
      bounds: nullable(obj({ minX: num("Left edge"), minY: num("Bottom edge"), width: num("Width"), height: num("Height") })),
      kills: int("Kill positions stored"),
      deaths: int("Death positions stored"),
      killDots: arr(obj({ x: num("x"), y: num("y"), headshot: bool("Headshot") })),
      deathDots: arr(obj({ x: num("x"), y: num("y") })),
    }),
    example: { game: G, id: 7, map: "de_dust2", levels: null, bounds: { minX: -2400, minY: -1200, width: 4200, height: 4500 }, kills: 18234, deaths: 18190, killDots: [{ x: -410, y: 1720, headshot: true }], deathDots: [{ x: -380, y: 1910 }] },
    notFound: "Unknown map, or the map belongs to another ranking",
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
schemas.Ban = obj({
  source: str("vac (VAC or game ban from Steam), sourcebans, sourcemod, amx or engine (a ban from the server logs)"),
  reason: nullable(str("Reason as the source gives it")),
  bannedAt: nullable(unix("When the ban was given (VAC: to the day); null when the source gives no usable date")),
  dateText: nullable(str("The source's own date text when bannedAt is null")),
  length: nullable(str("Length as the website shows it (English), e.g. Permanent or 7 days")),
  endsAt: nullable(unix("End of the ban when known")),
});
schemas.BannedPlayer = obj({
  position: int("Number of the row"),
  id: int("Player ID"),
  name: nullable(str("Name")),
  country: nullable(ref("Country")),
  bannedAt: nullable(unix("Newest ban of the player")),
  dateText: nullable(str("The source's date text when there is no usable date")),
  reason: nullable(str("The reason of the newest ban other than VAC, else the VAC one")),
  bans: arr(ref("Ban")),
  kills: int("Kills"),
  deaths: int("Deaths"),
  kpd: kpdNum(),
  hpk: fraction("Headshots per kill"),
  accuracy: fraction("Hits per shot"),
  url: link("the player's profile"),
});
schemas.LoadPoint = obj({
  time: unix("Time"),
  players: int("Players at that time"),
  min: int("Fewest players in the 10 minutes"),
  max: int("Most players in the 10 minutes"),
  map: nullable(str("Map")),
  uptime: nullable(int("Uptime of the game server in seconds; null when unknown")),
});
schemas.ActivityPoint = obj({
  time: unix("Start of the 15 minutes"),
  players: nullable(num("Players online, the average of the samples, one decimal; null without load samples")),
  servers: nullable(int("Servers with players; null without load samples")),
  kills: int("Kills"),
  headshots: int("Headshots"),
});
const eventPlayer = (what: string) => nullable(obj({ id: int(`${what}: player ID`), name: nullable(str("Name")), ...playerTag }));
const eventDetail = {
  weapon: nullable(obj({ code: str("Weapon code"), name: str("Weapon name") })),
  headshot: nullable(bool("Headshot (kills and deaths only)")),
  action: nullable(obj({ code: str("Action code"), name: str("Action description"), bonus: int("Points it brought") })),
  team: nullable(obj({ code: str("Team or role code"), name: str("Team or role name") })),
  oldName: nullable(str("Name before (name changes only)")),
  newName: nullable(str("Name after (name changes only)")),
  map: nullable(str("Map")),
};
schemas.Event = obj({
  time: unix("Time"),
  type: str("connect, entry, disconnect, team, role, name, action, playeraction (an action on another player), teambonus, kill, suicide or teamkill"),
  player: eventPlayer("Who did it"),
  other: eventPlayer("The other side (victim, target)"),
  ...eventDetail,
  server: nullable(str("Server name; null where the collector stores none")),
});
schemas.PlayerEvent = obj({
  time: unix("Time"),
  type: str("connect, entry, disconnect, team, role, name, action, playeraction, teambonus, kill, death (killed by other), suicide or teamkill"),
  other: eventPlayer("The other side (victim, killer, target)"),
  ...eventDetail,
});
schemas.Radar = obj({
  days: int("Days compared (14)"),
  activeDays: int("Days with play in them"),
  comparedPlayers: int("Players of the ranking active in those days (the average)"),
  axes: arr(
    obj({
      axis: str("kpd, kpm, assists, survived or wins (assists only where the game records them)"),
      value: nullable(num("Value; null without data")),
      average: nullable(num("Average of the active players; null without data")),
      relative: nullable(num("value / average; null without an average")),
      noData: bool("No value (no activity, or the game records nothing for it)"),
    }),
  ),
});
schemas.MapMarker = obj({
  id: int("Player ID"),
  name: nullable(str("Name")),
  country: nullable(ref("Country")),
  city: nullable(str("City of the point (GeoIP)")),
  lat: num("Latitude of the GeoIP city point"),
  lng: num("Longitude of the GeoIP city point"),
  rank: nullable(int("Place in the ranking; null for inactive members")),
  points: pointsInt(),
  kills: int("Kills"),
  deaths: int("Deaths"),
  kpd: kpdNum(),
  lastEvent: unix("Last seen"),
  server: nullable(obj({ id: int("Server ID"), name: str("Server name") })),
  inactive: bool("A clan member the collector moved out of the ranking (clan map only)"),
});
schemas.MapServer = obj({
  id: int("Server ID"),
  name: str("Server name"),
  address: str("Public address with port"),
  map: nullable(str("Current map")),
  city: nullable(str("City (GeoIP)")),
  country: nullable(ref("Country")),
  lat: num("Latitude (GeoIP)"),
  lng: num("Longitude (GeoIP)"),
  online: bool("The collector wrote a load sample in the last 30 minutes"),
  uptime: nullable(int("Uptime in seconds; null when offline")),
  vac: nullable(bool("VAC-secured; null when unknown")),
});
schemas.ClanDay = obj({
  day: str("Day (YYYY-MM-DD)", { format: "date" }),
  connectionTime: int("Time on the servers in seconds"),
  rounds: int("Rounds"),
  wins: int("Rounds won"),
  survived: int("Rounds survived"),
  kills: int("Kills"),
  deaths: int("Deaths"),
  kpd: kpdNum(),
  headshots: int("Headshots"),
  hpk: fraction("Headshots per kill"),
  assists: int("Kill assists"),
  shots: int("Shots"),
  hits: int("Hits"),
  accuracy: fraction("Hits per shot"),
  pointsChange: int("Points won or lost that day by all members"),
});
schemas.SearchPlayer = obj({
  position: int("Number of the hit"),
  game: str("Code of the ranking"),
  id: int("Player ID"),
  name: nullable(str("Current name")),
  alias: nullable(str("The used name that matched, when it is not the current one")),
  country: nullable(ref("Country")),
  bot: bool("Bot"),
  points: pointsInt(),
  kills: int("Kills"),
  deaths: int("Deaths"),
  kpd: kpdNum(),
  lastEvent: unix("Last seen"),
  url: nullable(link("the player; null for bots without a profile")),
});
schemas.SearchClan = obj({
  position: int("Number of the hit"),
  game: str("Code of the ranking"),
  id: int("Clan ID"),
  tag: str("Clan tag"),
  name: str("Clan name"),
  members: int("Ranked members"),
  avgPoints: nullable(int("Average points of the ranked members")),
  url: link("the clan"),
});
schemas.HallEntry = obj({
  place: int("Place on the podium (after moving up)"),
  id: nullable(int("Player ID; null for a player deleted since")),
  name: str("Name at the end of the period"),
  currentName: nullable(str("Name now; null when deleted")),
  country: nullable(ref("Country")),
  points: int("Points at the end of the period"),
  kills: int("Kills"),
  deaths: int("Deaths"),
  kpd: kpdNum(),
  headshots: int("Headshots"),
  hpk: fraction("Headshots per kill"),
  accuracy: fraction("Hits per shot"),
  killStreak: int("Longest kill streak"),
  connectionTime: int("Time on the servers in seconds"),
  favoriteWeapon: nullable(obj({ code: str("Weapon code"), name: str("Weapon name") })),
  rankName: nullable(str("Rank at the end of the period")),
});
schemas.HallPeriod = obj({
  unit: str("day, week, month or year"),
  every: int("Length in units (3 months: a quarter)"),
  start: str("First day", { format: "date" }),
  end: str("Last day", { format: "date" }),
  resetAt: unix("When the ranking was reset"),
  players: int("Ranked players at the reset"),
  places: arr(nullable(ref("HallEntry"))),
});
schemas.HallStars = obj({
  position: int("Number of the row"),
  id: int("Player ID"),
  name: str("Name of the latest entry"),
  country: nullable(ref("Country")),
  gold: int("First places"),
  silver: int("Second places"),
  bronze: int("Third places"),
  lastPeriod: str("Start of the latest period with a place", { format: "date" }),
});
schemas.VoiceChannel = obj({
  id: int("Channel ID"),
  name: str("Channel name"),
  spacer: nullable(str("Spacer channel: left, center, right or repeat; null for a channel")),
  topic: nullable(str("Topic")),
  password: bool("Needs a password"),
  clientCount: int("People in the channel"),
  clients: arr(obj({ name: str("Nickname"), away: bool("Away"), muted: bool("Microphone off"), deaf: bool("Sound off"), country: nullable(str("ISO code")) })),
  children: arr(ref("VoiceChannel")),
});

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
    const ok = e.image
      ? { description: `PNG, ${e.image.width}×${e.image.height} pixels`, content: { "image/png": { schema: { type: "string", format: "binary" } } } }
      : { description: "OK", content: { "application/json": { schema, example: e.example } } };
    paths[e.path] = {
      get: {
        operationId: e.operationId,
        tags: [e.tag],
        summary: e.summary,
        description: e.description,
        parameters: params.length ? params.map(({ example, ...p }) => (example === undefined ? p : { ...p, example })) : undefined,
        responses: {
          "200": ok,
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
        "Read-only JSON API of the gameWE statistics. It returns only what the website shows to everyone: no IP addresses, no chat, no hidden players, no admin data, no hidden rankings. Banned players are shown where the website shows them: on the bans list and their profile.",
        "",
        "- **Authentication:** none (the admin API below needs an API token).",
        "- **Rate limit:** 120 requests per minute and client address; above that the answer is `429` with a `Retry-After` header.",
        "- **Caching:** answers may be cached for 30 seconds (`Cache-Control: public, max-age=30`); banners as long as on the website (1 to 15 minutes).",
        "- **Banners** (`/players/{id}/banner`, `/rankings/{game}/servers/{id}/banner`, `/voice/teamspeak/banner`) answer `image/png`, errors as JSON; they are the same pictures as the website's `/banner/...png` addresses.",
        "- **Settings:** endpoints of parts the site's admin turned off (live map, player map, events, hall of fame, TeamSpeak) answer 404 like the website.",
        "- **CORS:** `Access-Control-Allow-Origin: *`, so pages on other sites can call it from the browser.",
        "- **Times** are Unix timestamps in seconds; days are `YYYY-MM-DD`.",
        `- **Lists** are paged: \`limit\` (1-${MAX_LIMIT}, default ${DEFAULT_LIMIT}) and \`page\` (from 1) or \`offset\`. The answer is \`{ data, pagination, links }\`: \`pagination\` has page, limit, offset, total and totalPages; \`links\` has self, first, prev, next and last (null at the ends). Lists with \`sort\` accept the listed fields and \`order=asc|desc\`.`,
        "- **Errors** are `{ \"error\": \"...\" }`: `400` for an invalid parameter (the message says which and what it accepts), `404` for anything unknown or not public, also for unknown paths under `/api/v1`. Unknown parameters are ignored.",
        "- **Points** are the values the website shows in its points columns (`points`, `avgPoints`, `totalPoints`, `pointsChange`); the older names `skill`, `avgSkill` and `skillChange` still carry the same values but are deprecated. Sort keys accept `points` as well as `skill`.",
        "- **Values** are computed as on the website: `kpd` is kills per death (the kills when there are no deaths), `hpk`, `accuracy` and shares are fractions (0.3125 = 31.25 %), `activity` uses the site's activity setting. Hidden players are left out exactly as on the website; banned players appear on the bans list and their profile only, as there.",
        "- **Order** is stable: equal values keep the order of their IDs.",
        ADMIN_API_INFO,
      ].join("\n"),
      license: { name: "GPL-3.0-or-later", identifier: "GPL-3.0-or-later" },
    },
    // Relative, so the examples show the address of the site they are read on.
    servers: [{ url: `${basePath}/api/v1` }],
    tags: [{ name: "Index" }, ...TAGS.map((name) => ({ name })), ...ADMIN_TAGS.map((name) => ({ name }))],
    // Scalar shows the public and the admin operations as two groups.
    "x-tagGroups": [
      { name: "Public", tags: ["Index", ...TAGS] },
      { name: "Admin", tags: ADMIN_TAGS },
    ],
    paths: { ...paths, ...adminPathItems() },
    components: { schemas: { ...schemas, ...adminSchemas }, securitySchemes: ADMIN_SECURITY_SCHEMES },
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
