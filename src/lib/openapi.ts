import { DEFAULT_LIMIT, MAX_LIMIT, MAX_OFFSET, paged } from "./api-params";
import { basePath } from "./base-path";

// OpenAPI 3.1 description of the public API (/api/v1/...), shown on /api by
// Scalar and served as /api/openapi.json. One entry per route under
// src/app/api/v1; scripts/vendor.mjs fails the build when a route has no
// entry here. The examples are made-up data on example.org.

type Schema = Record<string, unknown>;
type Param = { name: string; in: "path" | "query"; description: string; schema: Schema; required?: boolean; example?: unknown };
type Tag = "Rankings" | "Players" | "Countries and cities" | "Clans" | "Weapons" | "Maps" | "Awards and ranks" | "Actions and teams" | "Servers" | "Statistics";
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

const gameParam: Param = { name: "game", in: "path", required: true, description: "Code of the ranking, as in /api/v1/rankings", schema: str("", { pattern: "^[A-Za-z0-9_-]{1,32}$" }), example: "css" };
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
    bot: bool("Bot"),
    team: nullable(str("Team")),
    kills: int("Kills this map"),
    deaths: int("Deaths this map"),
    headshots: int("Headshots this map"),
    skill: int("Points"),
    skillChange: int("Points won or lost this map"),
    rank: int("Position in the ranking"),
    connectedSince: nullable(unix("Connected since")),
    dead: bool("Dead right now"),
    country: nullable(ref("Country")),
  }),
  RankingRow: obj({
    rank: int("Position in the whole ranking (by points)"),
    id: int("Player ID"),
    name: nullable(str("Name")),
    country: nullable(ref("Country")),
    skill: int("Points"),
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
    skill: int("Points of all its players"),
    avgSkill: int("Average points"),
    kills: int("Kills"),
    deaths: int("Deaths"),
    headshots: int("Headshots"),
    kpd: kpdNum(),
    hpk: fraction("Headshots per kill"),
    connectionTime: int("Time on the servers in seconds"),
    lastEvent: unix("Last seen of its most recent player"),
    playersUrl: link("its players (/rankings/{game}/players with country and city)"),
  }),
  Clan: obj({
    id: int("Clan ID"),
    tag: str("Clan tag"),
    name: str("Clan name"),
    homepage: nullable(str("Homepage (http or https only)")),
    country: nullable(ref("Country")),
    members: int("Ranked members"),
    avgSkill: int("Average points of the members"),
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
    name: str("Weapon name"),
    modifier: num("Points modifier"),
    kills: int("Kills"),
    headshots: int("Headshots"),
    hpk: fraction("Headshots per kill"),
    killShare: fraction("Share of all kills of the ranking"),
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
  }),
  MapPlayer: obj({
    rank: int("Position in this list"),
    id: int("Player ID"),
    name: nullable(str("Name")),
    ...playerTag,
    kills: int("Kills on this map"),
    deaths: int("Deaths on this map"),
    headshots: int("Headshots"),
    kpd: kpdNum(),
    hpk: fraction("Headshots per kill"),
  }),
  Action: obj({
    rank: int("Position in this list"),
    id: int("Action ID"),
    code: str("Action code"),
    description: nullable(str("Description")),
    team: nullable(str("Team the action is for")),
    rewardPlayer: int("Points for the player"),
    rewardTeam: int("Points for the team"),
    count: int("Times it happened"),
  }),
  AwardWinner: obj({ id: int("Player ID"), name: nullable(str("Name")), ...playerTag, value: int("Count (kills, actions, seconds for longest_playtime, ...)") }),
  RankPlayer: obj({
    id: int("Player ID"),
    name: nullable(str("Name")),
    ...playerTag,
    skill: int("Points"),
    kills: int("Kills"),
    connectionTime: int("Time on the servers in seconds"),
    lastEvent: unix("Last seen"),
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
    hpk: fraction("Headshots per kill"),
    accuracy: fraction("Hits per shot"),
    hitboxes: ref("Hitboxes"),
  }),
  Hitboxes: obj(Object.fromEntries(["head", "chest", "stomach", "leftarm", "rightarm", "leftleg", "rightleg"].map((z) => [z, int(`Hits on ${z}`)]))),
  PlayerMap: obj({ id: int("Map ID"), name: str("Map name"), kills: int("Kills"), deaths: int("Deaths"), headshots: int("Headshots"), kpd: kpdNum(), hpk: fraction("Headshots per kill") }),
  PlayerDay: obj({
    day: str("Day (YYYY-MM-DD)", { format: "date" }),
    skill: int("Points at the end of the day"),
    skillChange: int("Points won or lost that day"),
    connectionTime: int("Time on the servers in seconds"),
    rounds: int("Rounds"),
    wins: int("Rounds won"),
    kills: int("Kills"),
    deaths: int("Deaths"),
    kpd: kpdNum(),
    headshots: int("Headshots"),
    killStreak: int("Longest kill streak"),
    shots: int("Shots"),
    hits: int("Hits"),
  }),
  PlayerAward: obj({ day: str("Day won (YYYY-MM-DD)", { format: "date" }), id: int("Award ID"), code: str("Award code"), name: str("Award name"), verb: str("What was counted"), value: int("Count that day") }),
};

const pageSchema = (item: string): Schema => obj({ data: arr(ref(item)), pagination: ref("Pagination"), links: ref("Links") });

const RankingOverview = obj({
  game: str("Code of the ranking"),
  name: str("Name of the ranking"),
  baseGame: nullable(str("Code of the base game (realgame)")),
  servers: int("Servers"),
  players: int("Players online"),
  maxPlayers: int("Slots of all servers"),
  top: nullable(obj({ id: int("Player ID"), name: str("Name"), country: nullable(ref("Country")) })),
  topClan: nullable(obj({ id: int("Clan ID"), tag: str("Clan tag") })),
});
const ServerOnline: Schema = { allOf: [ref("Server"), obj({ online: arr(ref("LivePlayer")) })] };
const withGame = (s: Schema): Schema => ({ allOf: [obj({ game: str("Code of the ranking") }), s] });

// ---------------------------------------------------------------- examples

const de = { code: "DE", name: "Germany" };
const v1 = (path: string) => `${basePath}/api/v1${path}`;
const page = <T>(items: T[], total: number, path: string, args: Record<string, string | number> = {}) =>
  paged(items, total, { page: 1, limit: DEFAULT_LIMIT, offset: 0 }, v1(path), args);
const server = { id: 1, name: "Example Public #1", address: "cs.example.org:27015", map: "de_dust2", players: 2, maxPlayers: 24, mapStarted: 1767225600, kills: 182345, headshots: 61234, rounds: 9876, country: "DE" };
const live = { id: 42, name: "ExamplePlayer", bot: false, team: "CT", kills: 12, deaths: 5, headshots: 4, skill: 1450, skillChange: 23, rank: 7, connectedSince: 1767225900, dead: false, country: de };
const bot = { ...live, id: null, name: "BOT Example", bot: true, team: "TERRORIST", skillChange: 0, rank: 0, country: null };
const row = { rank: 1, id: 42, name: "ExamplePlayer", country: de, skill: 2210, kills: 5321, deaths: 2410, headshots: 1904, kpd: 2.21, hpk: 0.3578, accuracy: 0.3163, connectionTime: 432000, firstConnect: 1735689600, lastEvent: 1767225600, activity: 98 };
const place = { rank: 1, country: de, players: 412, skill: 498000, avgSkill: 1209, kills: 812345, deaths: 790122, headshots: 260111, kpd: 1.03, hpk: 0.3202, connectionTime: 98765432, lastEvent: 1767225600, playersUrl: `${v1("/rankings/css/players")}?country=de` };
const clan = { id: 3, tag: "[EX]", name: "Example Clan", homepage: "https://clan.example.org/", country: de, members: 8, avgSkill: 1650, kills: 23456, deaths: 19876, headshots: 7012, kpd: 1.18, hpk: 0.299, connectionTime: 1234567, lastEvent: 1767225600 };
const weapon = { rank: 1, code: "ak47", name: "AK-47", modifier: 1, kills: 123456, headshots: 45678, hpk: 0.37, killShare: 0.2612 };
const map = { id: 7, name: "de_dust2", kills: 345678, headshots: 112233, hpk: 0.3247, teamKills: 321, teamAWins: 5012, teamBWins: 4876, played: 2345, playTime: 3456789, rounds: 9888 };
const tag = { country: de, bot: false };
const zones = { head: 1904, chest: 5120, stomach: 2310, leftarm: 880, rightarm: 910, leftleg: 640, rightleg: 655 };
const days = [
  { day: "2026-01-01", players: 31, kills: 4210, headshots: 1388 },
  { day: "2026-01-02", players: 28, kills: 3987, headshots: 1290 },
];

const PLAYER_SORTS = ["skill", "name", "activity", "time", "kills", "deaths", "kpd", "hs", "hpk", "acc", "new"] as const;
const PLACE_SORTS = ["players", "skill", "avg", "kills", "deaths", "kpd", "hpk", "time", "name"] as const;
const CLAN_SORTS = ["skill", "members", "kills", "deaths", "headshots", "kpd", "hpk", "time", "activity", "tag"] as const;

export const endpoints: Endpoint[] = [
  // ------------------------------------------------------------ rankings
  {
    path: "/rankings",
    operationId: "listRankings",
    tag: "Rankings",
    summary: "All rankings",
    description: "Every ranking with its servers, the players online and the current number one.",
    schema: arr(RankingOverview),
    example: [{ game: "css", name: "Counter-Strike: Source", baseGame: "css", servers: 2, players: 9, maxPlayers: 48, top: { id: 42, name: "ExamplePlayer", country: de }, topClan: { id: 3, tag: "[EX]" } }],
  },
  {
    path: "/rankings/{game}",
    operationId: "getRanking",
    tag: "Rankings",
    summary: "One ranking",
    description: "Totals of a ranking and its best players by points. For paging, filters and sorting use `/rankings/{game}/players`.",
    params: [
      gameParam,
      { name: "limit", in: "query", description: "Players", schema: int("", { minimum: 1, maximum: 100, default: 10 }) },
      { name: "offset", in: "query", description: "Players to skip", schema: int("", { minimum: 0, maximum: 100000, default: 0 }) },
    ],
    schema: obj({
      game: str("Code of the ranking"),
      name: str("Name of the ranking"),
      baseGame: nullable(str("Code of the base game")),
      totals: obj({ players: int("Players"), newPlayers24h: int("New players in the last 24 hours"), kills: int("Kills"), headshots: int("Headshots"), servers: int("Servers") }),
      rankedPlayers: int("Players in the ranking"),
      players: arr(ref("RankingRow")),
    }),
    example: { game: "css", name: "Counter-Strike: Source", baseGame: "css", totals: { players: 1234, newPlayers24h: 5, kills: 456789, headshots: 123456, servers: 2 }, rankedPlayers: 1180, players: [row] },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/players",
    operationId: "listRankingPlayers",
    tag: "Players",
    summary: "Players of a ranking",
    description:
      "The ranking as a paged list, with the filters of the website: country, city, clan and a name search. `rank` is always the place in the whole ranking by points, also in a filtered or re-sorted list. Hidden and banned players are not listed. Sort fields: `skill` points, `name`, `activity` last seen, `time` time on the servers, `kills`, `deaths`, `kpd`, `hs` headshots, `hpk` headshots per kill, `acc` accuracy, `new` first seen.",
    params: [
      gameParam,
      countryQuery,
      { name: "city", in: "query", description: "Only this city (exact name, any case; best together with country)", schema: str("", { maxLength: 80 }), example: "Berlin" },
      { name: "clan", in: "query", description: "Only members of this clan (clan ID)", schema: int("", { minimum: 1 }) },
      { name: "q", in: "query", description: "Part of the current name", schema: str("", { maxLength: 64 }) },
    ],
    list: { item: "RankingRow", sorts: PLAYER_SORTS, sort: "skill" },
    example: page([row], 1180, "/rankings/css/players"),
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
    example: { game: "css", name: "Counter-Strike: Source", baseGame: "css", totals: { players: 1234, rankedPlayers: 1180, newPlayers24h: 5, kills: 456789, headshots: 123456, servers: 2 }, days },
    notFound: "Unknown ranking",
  },
  // ------------------------------------------------------------ countries and cities
  {
    path: "/rankings/{game}/countries",
    operationId: "listCountries",
    tag: "Countries and cities",
    summary: "Country ranking",
    description: "Countries of the ranked players (by GeoIP of their last connect) with summed and averaged values, by number of players. `avg` sorts by average points.",
    params: [gameParam],
    list: { item: "Place", sorts: PLACE_SORTS, sort: "players" },
    example: page([place], 34, "/rankings/css/countries"),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/countries/{country}",
    operationId: "getCountry",
    tag: "Countries and cities",
    summary: "One country",
    description: "Totals of one country and its place in the country ranking. Its players: `playersUrl`.",
    params: [gameParam, { name: "country", in: "path", required: true, description: "ISO 3166-1 alpha-2 code, any case", schema: str("", { pattern: "^[A-Za-z]{2}$" }), example: "de" }],
    schema: withGame(ref("Place")),
    example: { game: "css", ...place },
    notFound: "Unknown ranking, or no ranked player from this country",
  },
  {
    path: "/rankings/{game}/cities",
    operationId: "listCities",
    tag: "Countries and cities",
    summary: "City ranking",
    description: "Cities of the ranked players, optionally of one country, by number of players. Its players: `playersUrl` (country and city filter of `/players`).",
    params: [gameParam, countryQuery],
    list: { item: "PlaceCity", sorts: PLACE_SORTS, sort: "players" },
    example: page([{ ...place, city: "Berlin", players: 57, playersUrl: `${v1("/rankings/css/players")}?country=de&city=Berlin` }], 120, "/rankings/css/cities", { country: "de" }),
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
    example: page([{ rank: 1, ...clan }], 12, "/rankings/css/clans"),
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
    example: { game: "css", ...clan, membersUrl: v1("/rankings/css/clans/3/members") },
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  {
    path: "/rankings/{game}/clans/{id}/members",
    operationId: "listClanMembers",
    tag: "Clans",
    summary: "Members of a clan",
    description: "The ranked members of a clan; `rank` is the place in the whole ranking. Sort fields as in `/players`.",
    params: [gameParam, idParam("clan", 3)],
    list: { item: "RankingRow", sorts: PLAYER_SORTS, sort: "skill" },
    example: page([row], 8, "/rankings/css/clans/3/members"),
    notFound: "Unknown clan, or the clan belongs to another ranking",
  },
  // ------------------------------------------------------------ weapons
  {
    path: "/rankings/{game}/weapons",
    operationId: "listWeapons",
    tag: "Weapons",
    summary: "Weapons",
    description: "The weapons of a ranking that have kills, by kills.",
    params: [gameParam],
    list: { item: "Weapon", sorts: ["kills", "headshots", "hpk", "modifier", "name", "code"], sort: "kills" },
    example: page([weapon], 28, "/rankings/css/weapons"),
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
    example: { game: "css", code: "awp", name: "AWP", modifier: 1, kills: 54321, headshots: 9876, hpk: 0.1818, playersUrl: v1("/rankings/css/weapons/awp/players") },
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
    example: page([{ rank: 1, id: 42, name: "ExamplePlayer", ...tag, kills: 1234, headshots: 345, shots: 5678, hits: 2345, hpk: 0.2796, accuracy: 0.413 }], 410, "/rankings/css/weapons/awp/players"),
    notFound: "Unknown ranking or weapon",
  },
  // ------------------------------------------------------------ maps
  {
    path: "/rankings/{game}/maps",
    operationId: "listMaps",
    tag: "Maps",
    summary: "Maps",
    description: "The maps of a ranking that were played, by kills.",
    params: [gameParam],
    list: { item: "MapRanked", sorts: ["kills", "headshots", "played", "time", "rounds", "name"], sort: "kills" },
    example: page([{ rank: 1, ...map }], 15, "/rankings/css/maps"),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/maps/{id}",
    operationId: "getMap",
    tag: "Maps",
    summary: "One map",
    description: "Totals of one map. Its best players: `playersUrl`.",
    params: [gameParam, idParam("map", 7)],
    schema: { allOf: [obj({ game: str("Code of the ranking") }), ref("Map"), obj({ playersUrl: link("its best players") })] },
    example: { game: "css", ...map, playersUrl: v1("/rankings/css/maps/7/players") },
    notFound: "Unknown map, or the map belongs to another ranking",
  },
  {
    path: "/rankings/{game}/maps/{id}/players",
    operationId: "listMapPlayers",
    tag: "Maps",
    summary: "Best players on a map",
    description: "Ranked players with kills on this map in the last days, by kills (from the kill events).",
    params: [gameParam, idParam("map", 7), daysQuery(30, 90, "Days back")],
    list: { item: "MapPlayer" },
    example: page([{ rank: 1, id: 42, name: "ExamplePlayer", ...tag, kills: 512, deaths: 230, headshots: 171, kpd: 2.23, hpk: 0.334 }], 96, "/rankings/css/maps/7/players"),
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
      game: "css",
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
      game: "css",
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
    example: { game: "css", rankedPlayers: 1180, data: [{ index: 0, name: "Private", minKills: 0, maxKills: 49, players: 610, share: 0.5169, playersUrl: v1("/rankings/css/ranks/0/players") }] },
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/ranks/{rank}/players",
    operationId: "listRankPlayers",
    tag: "Awards and ranks",
    summary: "Players of a rank",
    description: "The ranked players of one rank, by kills.",
    params: [gameParam, { name: "rank", in: "path", required: true, description: "Rank index from /ranks", schema: int("", { minimum: 0, maximum: 999 }), example: 0 }],
    list: { item: "RankPlayer" },
    example: page([{ id: 42, name: "ExamplePlayer", ...tag, skill: 1210, kills: 48, connectionTime: 7200, lastEvent: 1767225600 }], 610, "/rankings/css/ranks/0/players"),
    notFound: "Unknown ranking or rank",
  },
  // ------------------------------------------------------------ actions and teams
  {
    path: "/rankings/{game}/actions",
    operationId: "listActions",
    tag: "Actions and teams",
    summary: "Actions",
    description: "The actions of a ranking that happened (bomb planted, flag captured, ...), by count. `reward` sorts by the points for the player.",
    params: [gameParam],
    list: { item: "Action", sorts: ["count", "reward", "name"], sort: "count" },
    example: page([{ rank: 1, id: 11, code: "Planted_The_Bomb", description: "Planted the bomb", team: "TERRORIST", rewardPlayer: 3, rewardTeam: 0, count: 2345 }], 9, "/rankings/css/actions"),
    notFound: "Unknown ranking",
  },
  {
    path: "/rankings/{game}/teams",
    operationId: "listTeams",
    tag: "Actions and teams",
    summary: "Teams and roles",
    description: "The teams of a ranking with how often players joined them, and its roles (classes), not paged.",
    params: [gameParam],
    schema: obj({ game: str("Code of the ranking"), teams: arr(ref("TeamWithJoins")), roles: arr(ref("Team")) }),
    example: {
      game: "css",
      teams: [{ id: 1, code: "CT", name: "Counter-Terrorists", timePlayed: 3456789, kills: 0, deaths: 0, headshots: 0, kpd: 0, wins: 4876, losses: 5012, rounds: 9888, joined: 8123 }],
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
    description: "One server of a ranking with who is online.",
    params: [gameParam, idParam("server", 1)],
    schema: withGame(ServerOnline),
    example: { game: "css", ...server, online: [live] },
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
    example: { game: "css", id: 1, hours: 24, maxPlayers: 24, data: [{ time: 1767225600, players: 12, min: 10, max: 14, map: "de_dust2" }] },
    notFound: "Unknown ranking or server, or the server belongs to another ranking",
  },
  {
    path: "/servers",
    operationId: "listServers",
    tag: "Servers",
    summary: "All servers",
    description: "The servers of all rankings.",
    schema: arr(withGame(ref("Server"))),
    example: [{ game: "css", ...server }],
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
    description: "Public summary of one player. Hidden or banned players, bots without a profile and players of hidden rankings answer 404, also on all `/players/{id}/...` endpoints.",
    params: [idParam("player")],
    schema: obj({
      id: int("Player ID"),
      game: str("Code of the ranking"),
      name: nullable(str("Name")),
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
      kpd: kpdNum(),
      shots: int("Shots"),
      hits: int("Hits"),
      rounds: int("Rounds"),
      wins: int("Rounds won"),
      losses: int("Rounds lost"),
      connectionTime: int("Time on the servers in seconds"),
      firstConnect: nullable(unix("First seen")),
      lastEvent: unix("Last seen"),
      activity: int("Activity in percent (100 = played today)", { minimum: 0, maximum: 100 }),
    }),
    example: { id: 42, game: "css", name: "ExamplePlayer", rank: 1, country: de, clan: { id: 3, tag: "[EX]", name: "Example Clan" }, skill: 2210, kills: 5321, deaths: 2410, suicides: 12, headshots: 1904, teamKills: 3, killStreak: 17, kpd: 2.21, shots: 98000, hits: 31000, rounds: 2100, wins: 1100, losses: 1000, connectionTime: 432000, firstConnect: 1735689600, lastEvent: 1767225600, activity: 98 },
    notFound: "Unknown, hidden or bot player",
  },
  {
    path: "/players/{id}/weapons",
    operationId: "listPlayerWeapons",
    tag: "Players",
    summary: "Weapons of a player",
    description: "A player's weapons with kills, accuracy and hits per body zone, by kills.",
    params: [idParam("player")],
    list: { item: "PlayerWeapon", sorts: ["kills", "deaths", "headshots", "hpk", "accuracy", "damage", "name"], sort: "kills" },
    example: page([{ code: "ak47", name: "AK-47", kills: 2100, deaths: 900, headshots: 830, shots: 41000, hits: 12500, damage: 380000, hpk: 0.3952, accuracy: 0.3049, hitboxes: zones }], 14, "/players/42/weapons"),
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
    description: "A player's days on the servers, newest first: points, kills and time per day.",
    params: [idParam("player")],
    list: { item: "PlayerDay" },
    example: page([{ day: "2026-01-01", skill: 2210, skillChange: 35, connectionTime: 5400, rounds: 40, wins: 22, kills: 61, deaths: 30, kpd: 2.03, headshots: 20, killStreak: 7, shots: 1400, hits: 450 }], 210, "/players/42/history"),
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
    example: { id: 42, game: "css", rank: { index: 9, name: "General", minKills: 5000, nextAt: null }, data: [{ id: 5, code: "awp", name: "AWP Master", verb: "kills with awp", wins: 14, ribbon: { class: 1, name: "{LANG_SILVER}", level: 6, maxLevel: 8 } }] },
    notFound: "Unknown, hidden or bot player",
  },
];

schemas.PlaceCity = { allOf: [ref("Place"), obj({ city: str("City") })] };
schemas.MapRanked = { allOf: [obj({ rank: int("Position in this list") }), ref("Map")] };
schemas.ClanRanked = { allOf: [obj({ rank: int("Position in this list") }), ref("Clan")] };
schemas.Team = obj({
  id: int("Team or role ID"),
  code: str("Code"),
  name: str("Name"),
  timePlayed: int("Time played in seconds"),
  kills: int("Kills"),
  deaths: int("Deaths"),
  headshots: int("Headshots"),
  kpd: kpdNum(),
  wins: int("Rounds won"),
  losses: int("Rounds lost"),
  rounds: int("Rounds"),
});
schemas.TeamWithJoins = { allOf: [ref("Team"), obj({ joined: int("Times players joined the team") })] };

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
        "- **Errors** are `{ \"error\": \"...\" }`: `400` for an invalid parameter (the message says which and what it accepts), `404` for anything unknown or not public. Unknown parameters are ignored.",
      ].join("\n"),
      license: { name: "GPL-3.0-or-later", identifier: "GPL-3.0-or-later" },
    },
    // Relative, so the examples show the address of the site they are read on.
    servers: [{ url: `${basePath}/api/v1` }],
    tags: [{ name: "Index" }, ...(["Rankings", "Players", "Countries and cities", "Clans", "Weapons", "Maps", "Awards and ranks", "Actions and teams", "Servers", "Statistics"] satisfies Tag[]).map((name) => ({ name }))],
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
