import "server-only";
import { cache } from "react";
import { adminQuery, dialect, likeOp, query, queryOne, sinceDays, type Param } from "./db";
import { BOT_POINTS_PREFIX, BOT_STATS_PREFIX, botSettingKeys, botSettingOn, botStatsOn, RANK_BOTS_PREFIX } from "./bot-settings";
import { addDays, dayOf, siteDay } from "./day";
import { ttlCache } from "./ttl-cache";
import { connectTypes, miscCountries, placeOptions, type PlaceCount, type PlaceOption } from "./place-counts";
import { nowUnix, steamIds } from "./format";
import { baseGameOf, GAME_HAS_DATA, gameKind } from "./games";
import { allClansSql, allKillsSql, allPlayersSql, rankingKillsSql, rankingPlayersSql } from "./general-stats";
import { hiddenSql, isBotSql, liveEntry } from "./hidden";
import { LOAD_INTERVAL_MAX, type MapSort } from "./map-table";
import { playerCount, sumCounts, type PlayerCount } from "./player-count";
import { RADAR_KEYS, RADAR_SQL, type RadarAverage } from "./radar";
import { winsByMap } from "./shares";
import type { PlaceKind } from "./places";
import { placeSorts, rankingSorts, type PlaceSort, type RankingSort } from "./sorts";

// All reads of the HLstatsX/gameME tables the collector fills.
// Times are Unix seconds unless a field says otherwise.

// ---------------------------------------------------------------- helpers

// Per-player totals live in a weekly table plus a monthly archive
// (hlstats_Players_Weapons + hlstats_Players_Weapons_History_Months, ...).
// This returns both as one derived table so callers can SUM over it.
function weeksAndMonths(table: string, cols: string, where: string, params: Param[]) {
  return {
    sql: `(SELECT ${cols} FROM hlstats_${table} WHERE ${where}
           UNION ALL
           SELECT ${cols} FROM hlstats_${table}_History_Months WHERE ${where})`,
    params: [...params, ...params],
  };
}

function like(s: string): string {
  return `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Place in the ranking (1 + players with more points) for each game and skill,
// keyed "game|skill". With the index game_skill (game, hideranking, skill,
// playerId, collector migration 18) both reads stay in the index: the players
// above the best of the skills are counted, and the players between the
// lowest and the best skill are read per skill. A page of the ranking spans
// a narrow band of points, so that is a few hundred index entries instead of
// a pass over every player of the ranking.
async function rankPositions(players: { game: string; skill: number }[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const byGame = new Map<string, Set<number>>();
  for (const p of players) {
    const skills = byGame.get(p.game) ?? new Set<number>();
    skills.add(Number(p.skill));
    byGame.set(p.game, skills);
  }
  await Promise.all(
    [...byGame].map(async ([game, set]) => {
      const skills = [...set].sort((a, b) => b - a);
      const top = skills[0];
      const low = skills[skills.length - 1];
      const [above, band] = await Promise.all([
        queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM hlstats_Players WHERE game = ? AND hideranking = 0 AND skill > ?`, [game, top]),
        top > low
          ? query<{ skill: number; n: number }>(
              `SELECT skill, COUNT(*) AS n FROM hlstats_Players
               WHERE game = ? AND hideranking = 0 AND skill > ? AND skill <= ? GROUP BY skill`,
              [game, low, top],
            )
          : [],
      ]);
      // Players per skill in the band, best first; a skill's place is 1 +
      // everyone above it.
      const counts = band.map((r) => ({ skill: Number(r.skill), n: Number(r.n) })).sort((a, b) => b.skill - a.skill);
      let higher = Number(above?.n ?? 0);
      let i = 0;
      for (const skill of skills) {
        while (i < counts.length && counts[i].skill > skill) higher += counts[i++].n;
        out.set(`${game}|${skill}`, higher + 1);
      }
    }),
  );
  return out;
}

// The players of one country, state or city (a WHERE on l.flag, l.state or
// l.city): read from the matching locations to their players. Left to itself
// MariaDB walks the whole ranking by the index game_skill and looks up each
// player's location, which takes seconds for a city ranking or a small
// country; STRAIGHT_JOIN keeps this order there.
function placeJoins(table: string) {
  const join = dialect() === "mariadb" ? "STRAIGHT_JOIN" : "JOIN";
  return `hlstats_Players_Locations l
    ${join} hlstats_Players_Data d ON d.location_id = l.id
    ${join} ${table} p ON p.playerId = d.playerId`;
}

// ---------------------------------------------------------------- games

export type Game = { id: number; code: string; name: string; realgame: string | null };

// hlstats_Games.realgame comes with the collector's init script; in older databases the
// pages work without it (no game tags) and look again every 5 minutes.
let realgameCol: { ok: Promise<boolean>; at: number } | undefined;
async function gameCols() {
  if (!realgameCol || (Date.now() - realgameCol.at > 300_000 && !(await realgameCol.ok))) {
    realgameCol = { ok: query(`SELECT realgame FROM hlstats_Games WHERE 1 = 0`).then(() => true, () => false), at: Date.now() };
  }
  return `id, TRIM(code) AS code, name, ${(await realgameCol.ok) ? "TRIM(realgame)" : "NULL"} AS realgame`;
}

const withBase = (g: Game): Game => ({ ...g, realgame: baseGameOf(g.code, g.realgame) });

// Both run once per request (React cache): the layouts, the metadata and
// the page of a ranking all ask for the same game.
// withData: only rankings with a server or a player (for ranking choices).
export const getGames = cache(async (withData = false) => {
  return (
    await query<Game>(
      `SELECT ${await gameCols()} FROM hlstats_Games WHERE hidden = '0'${withData ? ` AND ${GAME_HAS_DATA}` : ""} ORDER BY display_id, name`,
    )
  ).map(withBase);
});

// Hidden rankings are left out unless withHidden is set (admins only).
export const getGame = cache(async (code: string, withHidden = false) => {
  const g = await queryOne<Game>(`SELECT ${await gameCols()} FROM hlstats_Games WHERE code = ?${withHidden ? "" : ` AND hidden = '0'`}`, [code]);
  return g ? withBase(g) : g;
});

// Whether the ranking's game logs shots: not Counter-Strike 2 (no weaponstats
// plugin), whose pages leave out shots, accuracy and shots per kill.
export const gameHasShots = cache(async (code: string) => !gameKind((await getGame(code, true))?.realgame)?.noShots);

// ---------------------------------------------------------------- servers

export type Server = {
  serverId: number;
  address: string;
  port: number;
  publicaddress: string;
  name: string;
  act_players: number;
  bots: number;
  max_players: number;
  act_map: string;
  map_started: number;
  kills: number;
  headshots: number;
  suicides: number;
  rounds: number;
  players: number;
  ct_wins: number;
  ts_wins: number;
  bombs_planted: number;
  bombs_defused: number;
  country_code: string | null;
  game: string;
  game_name: string | null;
  realgame: string | null;
  // What the game server says about itself (collector features.server_info):
  // version string, "linux" / "windows" / "mac", "secure" / "insecure"; "" is
  // unknown.
  server_version: string;
  server_os: string;
  server_vac: string;
};

// Players online, at most the slots: older collectors kept kicked bots counted
// (66/48), and hlstats_server_load still holds those spikes.
const capped = (p: string) => `CASE WHEN ${p}max_players > 0 AND ${p}act_players > ${p}max_players THEN ${p}max_players ELSE ${p}act_players END`;

// hlstats_Players.career_kills (collector schema 20) are the kills of the
// career rank: kills of bots count there by gamewe_bot_kills_<game>, while
// kills follows gamewe_bot_stats_<game>. Older databases have only kills.
// The pages look again for the column every 5 minutes.
let careerCol: { ok: Promise<boolean>; at: number } | undefined;
export async function careerKills(p = "p.") {
  if (!careerCol || (Date.now() - careerCol.at > 300_000 && !(await careerCol.ok))) {
    careerCol = { ok: query(`SELECT career_kills FROM hlstats_Players WHERE 1 = 0`).then(() => true, () => false), at: Date.now() };
  }
  return (await careerCol.ok) ? `${p}career_kills` : `${p}kills`;
}

// Bots online, counted in act_players too (player-count.ts caps them at
// act_players): hlstats_Servers.act_bots of the collector (migration 6),
// written with act_players. Older databases count the bots' live rows
// (uniqueId BOT:<name>), which miss bots: the rows are cleared at a map
// change while act_players holds the count from before, and servers of one
// game with the same bot names share a bot's row (one per player). The
// pages look again for the column every 5 minutes.
let actBotsCol: { ok: Promise<boolean>; at: number } | undefined;
async function actBotsOk() {
  if (!actBotsCol || (Date.now() - actBotsCol.at > 300_000 && !(await actBotsCol.ok))) {
    actBotsCol = { ok: query(`SELECT act_bots FROM hlstats_Servers WHERE 1 = 0`).then(() => true, () => false), at: Date.now() };
  }
  return actBotsCol.ok;
}
async function botsOnline(p: string) {
  return (await actBotsOk())
    ? `${p}act_bots`
    : `(SELECT COUNT(*) FROM hlstats_Livestats lb WHERE lb.server_id = ${p}serverId AND lb.unique_id LIKE 'BOT%')`;
}

// With the ranking's name and base game (hlstats_Games) for the Game column.
const serverCols = `s.serverId, s.address, s.port, s.publicaddress, s.name, ${capped("s.")} AS act_players, s.max_players, s.act_map,
  s.map_started, s.kills, s.headshots, s.suicides, s.rounds, s.players, s.ct_wins, s.ts_wins, s.bombs_planted,
  s.bombs_defused, s.country_code, s.game, g.name AS game_name, g.realgame`;
const serverFrom = "hlstats_Servers s LEFT JOIN hlstats_Games g ON g.code = s.game";

// hlstats_Servers.server_version, server_os and server_vac come with collector
// migration 5 (features.server_info); in older databases they are empty, and
// the pages look again every 5 minutes.
let serverInfoCol: { ok: Promise<boolean>; at: number } | undefined;
async function serverInfoOk() {
  if (!serverInfoCol || (Date.now() - serverInfoCol.at > 300_000 && !(await serverInfoCol.ok))) {
    serverInfoCol = { ok: query(`SELECT server_version, server_os, server_vac FROM hlstats_Servers WHERE 1 = 0`).then(() => true, () => false), at: Date.now() };
  }
  return serverInfoCol.ok;
}
async function serverInfoCols() {
  return (await serverInfoOk())
    ? "s.server_version, s.server_os, s.server_vac"
    : "'' AS server_version, '' AS server_os, '' AS server_vac";
}

export async function getServers(game: string) {
  return query<Server>(
    `SELECT ${serverCols}, ${await botsOnline("s.")} AS bots, ${await serverInfoCols()} FROM ${serverFrom} WHERE s.game = ? ORDER BY s.display_id, s.serverId`,
    [game],
  );
}

export async function getServer(id: number) {
  return queryOne<Server>(
    `SELECT ${serverCols}, ${await botsOnline("s.")} AS bots, ${await serverInfoCols()} FROM ${serverFrom} WHERE s.serverId = ?`,
    [id],
  );
}

export type Totals = { players: number; newPlayers: number; kills: number; headshots: number; servers: number };

// Counted over all players of the ranking (both player tables, hidden and
// banned ones too, bots left out; kills and headshots from the players, so
// a reset of the player statistics sets them back to 0; general-stats.ts):
// kept for a minute (ttl-cache.ts).
const totalsCache = ttlCache<Totals>(60_000, 600_000);

export function getTotals(game: string): Promise<Totals> {
  return totalsCache(game, () => loadTotals(game));
}

async function loadTotals(game: string): Promise<Totals> {
  const [p, k, fresh, s] = await Promise.all([
    queryOne<{ n: number | string }>(rankingPlayersSql, [game, game, game, game]),
    queryOne<{ kills: number | string | null; headshots: number | string | null }>(rankingKillsSql, [game, game]),
    // From the few players of the last day (index first_connect), not by
    // joining every player of the ranking.
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM hlstats_Players_Data d JOIN hlstats_Players p ON p.playerId = d.playerId
       WHERE d.first_connect >= ? AND p.game = ?`,
      [nowUnix() - 86400, game],
    ),
    queryOne<{ servers: number }>(`SELECT COUNT(*) AS servers FROM hlstats_Servers WHERE game = ?`, [game]),
  ]);
  return {
    players: Math.max(0, Number(p?.n ?? 0)),
    newPlayers: Number(fresh?.n ?? 0),
    kills: Number(k?.kills ?? 0),
    headshots: Number(k?.headshots ?? 0),
    servers: Number(s?.servers ?? 0),
  };
}

export type LivePlayer = {
  server_id: number;
  player_id: number;
  name: string;
  team: string;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  rounds: number;
  ping: number;
  connected: number;
  skill: number;
  skill_change: number;
  is_dead: number;
  position: number | null;
  is_bot: number;
  flag: string | null;
  country: string | null;
};

// Position is the player's place in the ranking (null for hidden players).
export async function getLivePlayers(game: string, serverId?: number): Promise<LivePlayer[]> {
  const where = serverId ? `l.server_id = ?` : `s.game = ?`;
  type Row = Omit<LivePlayer, "position"> & { rankHidden: number | null; rankGame: string | null; rankSkill: number | null };
  const rows = await query<Row>(
    `SELECT l.server_id, l.player_id, l.name, l.team, l.kills, l.deaths, l.headshots, l.shots, l.hits,
            l.rounds, l.ping, l.connected, l.skill, l.skill_change, l.is_dead,
            CASE WHEN l.unique_id LIKE 'BOT%' THEN 1 ELSE 0 END AS is_bot, loc.flag, loc.country,
            p.hideranking AS rankHidden, p.game AS rankGame, p.skill AS rankSkill
     FROM hlstats_Livestats l
     JOIN hlstats_Servers s ON s.serverId = l.server_id
     LEFT JOIN hlstats_Players p ON p.playerId = l.player_id
     LEFT JOIN hlstats_Players_Locations loc ON loc.id = l.cli_location_id
     WHERE ${where} AND l.player_hidden = 0
     ORDER BY l.team, l.kills DESC, l.skill DESC, l.player_id`,
    [serverId ?? game],
  );
  const ranked = (r: Row) => r.rankGame !== null && r.rankSkill !== null && Number(r.rankHidden) === 0;
  const pos = await rankPositions(rows.filter(ranked).map((r) => ({ game: r.rankGame as string, skill: Number(r.rankSkill) })));
  // A player hidden from the ranking (e.g. by !hide) is still on the server:
  // listed with in-game name and live values, but without id or link.
  return rows.map(({ rankHidden, rankGame, rankSkill, ...r }) =>
    liveEntry({ ...r, position: ranked({ rankHidden, rankGame, rankSkill, ...r }) ? (pos.get(`${rankGame}|${Number(rankSkill)}`) ?? null) : null }, rankHidden),
  );
}

// One row per server and 10 minutes (collector 1.5.0): players at that
// moment (bots included), min/max within the interval, the map and the
// uptime of the game server in minutes.
export type LoadPoint = { timestamp: number; act_players: number; min_players: number; max_players: number; uptime: number; map: string | null };

// The load of every server of a ranking since `since`, by server id, in one
// query (the ranking's start page shows a graph per server).
export async function getServerLoads(game: string, since: number): Promise<Map<number, LoadPoint[]>> {
  const rows = await query<LoadPoint & { server_id: number }>(
    `SELECT l.server_id, l.timestamp, ${capped("l.")} AS act_players, l.min_players, l.max_players, l.uptime, m.map
     FROM hlstats_server_load l LEFT JOIN hlstats_Maps m ON m.id = l.map
     WHERE l.server_id IN (SELECT serverId FROM hlstats_Servers WHERE game = ?) AND l.timestamp >= ?
     ORDER BY l.server_id, l.timestamp`,
    [game, since],
  );
  const out = new Map<number, LoadPoint[]>();
  for (const { server_id, ...r } of rows) {
    const id = Number(server_id);
    if (!out.has(id)) out.set(id, []);
    out.get(id)!.push(loadPoint(r));
  }
  return out;
}

const loadPoint = (r: LoadPoint): LoadPoint => ({
  ...r,
  timestamp: Number(r.timestamp),
  act_players: Number(r.act_players),
  min_players: Number(r.min_players),
  max_players: Number(r.max_players),
  uptime: Number(r.uptime),
});

export async function getServerLoad(serverId: number, since: number) {
  const rows = await query<LoadPoint>(
    `SELECT l.timestamp, ${capped("l.")} AS act_players, l.min_players, l.max_players, l.uptime, m.map
     FROM hlstats_server_load l LEFT JOIN hlstats_Maps m ON m.id = l.map
     WHERE l.server_id = ? AND l.timestamp >= ? ORDER BY l.timestamp`,
    [serverId, since],
  );
  return rows.map(loadPoint);
}

export type DayPoint = { day: string; players: number; kills: number; headshots: number };

// One entry per day (site's time zone) of the last `days` days, oldest first;
// days without history stay null, so a chart shows the full range from the start.
export function everyDay<T extends { day: string }>(rows: T[], days: number): { day: string; point: T | null }[] {
  const byDay = new Map(rows.map((r) => [String(r.day).slice(0, 10), r]));
  const today = siteDay();
  return Array.from({ length: days }, (_, i) => {
    const day = addDays(today, i - days + 1);
    return { day, point: byDay.get(day) ?? null };
  });
}

// Active players and kills per day, from hlstats_Players_History. Kept for a
// minute per ranking (ttl-cache.ts): the ranking's start page asks on every
// view.
const dailyCache = ttlCache<DayPoint[]>(60_000, 600_000);

export function getDailyActivity(game: string, days: number): Promise<DayPoint[]> {
  return dailyCache(`${game}|${days}|${siteDay()}`, () =>
    query<DayPoint>(
      `SELECT eventTime AS day, COUNT(*) AS players, SUM(kills) AS kills, SUM(headshots) AS headshots
       FROM hlstats_Players_History WHERE game = ? AND ${sinceDays("eventTime")}
       GROUP BY eventTime ORDER BY eventTime`,
      [game, days],
    ),
  );
}

// Players online and servers with players (hlstats_server_load, over the
// ranking's servers), kills and headshots (hlstats_Events_Frags) per 15
// minutes of the last days, for the graphs on the start page and a ranking's
// page. A month of frags of every ranking: kept for five minutes per ranking,
// then the old graph is shown while one reload runs in the background
// (ttl-cache.ts), so no visitor waits for it.
export type HourlyActivity = { start: number; step: number; players: (number | null)[]; servers: (number | null)[]; kills: number[]; headshots: number[] };

// Seconds per point of these graphs. The collector stores the server load every
// 10 minutes, so each point holds one or two samples.
const ACTIVITY_STEP = 900;

const hourlyCache = ttlCache<HourlyActivity>(300_000, 86_400_000, 100);

// game null: all rankings together (start page).
export function getHourlyActivity(game: string | null, days: number): Promise<HourlyActivity> {
  return hourlyCache(`${game ?? "*"}|${days}`, () => loadHourlyActivity(game, days));
}

async function loadHourlyActivity(game: string | null, days: number): Promise<HourlyActivity> {
  const now = nowUnix();
  const step = ACTIVITY_STEP;
  const start = Math.floor((now - days * 86400) / step) * step;
  const n = Math.floor((now - start) / step) + 1;
  const [frags, load] = await Promise.all([
    query<{ h: number; kills: number; headshots: number }>(
      `SELECT FLOOR(f.timestamp_id / ?) AS h, COUNT(*) AS kills, SUM(f.headshot) AS headshots
       FROM hlstats_Events_Frags f
       WHERE ${game === null ? "" : "f.game_id = (SELECT id FROM hlstats_Games WHERE code = ?) AND "}f.timestamp_id >= ?
       GROUP BY 1`,
      game === null ? [step, start] : [step, game, start],
    ),
    query<{ server_id: number; h: number; p: number }>(
      `SELECT l.server_id, FLOOR(l.timestamp / ?) AS h, AVG(${capped("l.")}) AS p
       FROM hlstats_server_load l
       WHERE ${game === null ? "" : "l.server_id IN (SELECT serverId FROM hlstats_Servers WHERE game = ?) AND "}l.timestamp >= ?
       GROUP BY 1, 2`,
      game === null ? [step, start] : [step, game, start],
    ),
  ]);
  const first = start / step;
  const kills = new Array<number>(n).fill(0);
  const headshots = new Array<number>(n).fill(0);
  for (const r of frags) {
    const i = Number(r.h) - first;
    if (i >= 0 && i < n) {
      kills[i] = Number(r.kills);
      headshots[i] = Number(r.headshots ?? 0);
    }
  }
  const players = new Array<number | null>(n).fill(null);
  const servers = new Array<number | null>(n).fill(null);
  for (const r of load) {
    const i = Number(r.h) - first;
    if (i >= 0 && i < n) {
      players[i] = Math.round(((players[i] ?? 0) + Number(r.p)) * 10) / 10;
      servers[i] = (servers[i] ?? 0) + (Number(r.p) > 0 ? 1 : 0);
    }
  }
  return { start, step, players, servers, kills, headshots };
}

// ---------------------------------------------------------------- awards

export type DailyAward = {
  awardId: number;
  awardType: "W" | "O";
  name: string;
  verb: string;
  d_winner_id: number | null;
  d_winner_count: number | null;
  winnerName: string | null;
};

export function getDailyAwards(game: string) {
  return query<DailyAward>(
    // A winner hidden since the award was given counts as no winner.
    `SELECT a.awardId, a.awardType, a.name, a.verb,
            CASE WHEN ${hiddenSql("a.d_winner_id")} THEN 0 ELSE a.d_winner_id END AS d_winner_id,
            CASE WHEN ${hiddenSql("a.d_winner_id")} THEN 0 ELSE a.d_winner_count END AS d_winner_count,
            CASE WHEN ${hiddenSql("a.d_winner_id")} THEN NULL ELSE d.lastName END AS winnerName
     FROM hlstats_Awards a LEFT JOIN hlstats_Players_Data d ON d.playerId = a.d_winner_id
     WHERE a.game = ? ORDER BY a.awardType DESC, a.name, a.awardId`,
    [game],
  );
}

export type AwardHistoryRow = {
  date: string;
  awardId: number;
  name: string;
  verb: string;
  winner_id: number;
  winner_count: number;
  winnerName: string | null;
};

export async function getAwardHistory(game: string, days: number) {
  const dates = await query<{ date: string }>(
    `SELECT DISTINCT h.date FROM hlstats_Awards_History h
     JOIN hlstats_Awards a ON a.awardId = h.award_id WHERE a.game = ?
     ORDER BY h.date DESC LIMIT ?`,
    [game, days],
  );
  if (dates.length === 0) return [];
  return query<AwardHistoryRow>(
    `SELECT h.date, a.awardId, a.name, a.verb, h.winner_id, h.winner_count, d.lastName AS winnerName
     FROM hlstats_Awards_History h
     JOIN hlstats_Awards a ON a.awardId = h.award_id
     LEFT JOIN hlstats_Players_Data d ON d.playerId = h.winner_id
     WHERE a.game = ? AND h.date IN (?) AND NOT ${hiddenSql("h.winner_id")} ORDER BY h.date DESC, a.awardType DESC, a.name`,
    [game, dates.map((d) => d.date)],
  );
}

// Daily leaders computed from hlstats_Players_History. The collector does not
// fill hlstats_Awards, so these stand in for gameME's daily awards.
export const leaderCategories = ["kills", "headshots", "skill_change", "connection_time", "team_kills", "suicides", "deaths"] as const;
export type LeaderCategory = (typeof leaderCategories)[number];
export type Leader = { day: string; category: LeaderCategory; playerId: number; name: string | null; value: number };

export async function getDailyLeaders(game: string, days: number): Promise<Leader[]> {
  const perCategory = await Promise.all(
    leaderCategories.map((c) =>
      query<Omit<Leader, "category">>(
        `SELECT h.eventTime AS day, h.playerId, d.lastName AS name, h.${c} AS value
         FROM hlstats_Players_History h
         JOIN (SELECT eventTime, MAX(${c}) AS m FROM hlstats_Players_History
               WHERE game = ? AND ${sinceDays("eventTime")} GROUP BY eventTime) x
           ON x.eventTime = h.eventTime AND h.${c} = x.m
         JOIN hlstats_Players p ON p.playerId = h.playerId AND p.hideranking = 0
         LEFT JOIN hlstats_Players_Data d ON d.playerId = h.playerId
         WHERE h.game = ? AND x.m > 0 ORDER BY h.eventTime DESC, h.playerId`,
        [game, days - 1, game],
      ).then((rows) => {
        // Ties: the first player per day wins.
        const seen = new Set<string>();
        return rows.filter((r) => !seen.has(r.day) && seen.add(r.day)).map((r) => ({ ...r, category: c }));
      }),
    ),
  );
  return perCategory.flat();
}

// ---------------------------------------------------------------- players

export type RankingRow = {
  playerId: number;
  name: string | null;
  skill: number;
  last_event: number;
  first_connect: number | null;
  connection_time: number;
  kills: number;
  careerKills: number; // the kills of the career rank (careerKills)
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  flag: string | null;
  country: string | null;
  // Place in the whole ranking; only filled in a country, state or city ranking.
  globalRank?: number;
};

export { rankingSorts, type RankingSort } from "./sorts";

type RankingOpts = Parameters<typeof loadRanking>[0];
type RankingResult = Awaited<ReturnType<typeof loadRanking>>;

// A page of the ranking sorts all players of the ranking (hundreds of
// thousands after an import): kept for 30 seconds per page, sort and place
// (ttl-cache.ts); a search always asks the database.
const rankingCache = ttlCache<RankingResult>(30_000, 300_000, 500);

export function getRanking(opts: RankingOpts): Promise<RankingResult> {
  return opts.search ? loadRanking(opts) : rankingCache(JSON.stringify(opts), () => loadRanking(opts));
}

async function loadRanking(opts: {
  game: string;
  sort: RankingSort;
  asc: boolean;
  search: string;
  limit: number;
  offset: number;
  // Only players from this country (two-letter code), state and/or city.
  country?: string;
  state?: string;
  city?: string;
  // Only members of this clan.
  clan?: number;
  // Fill globalRank also without a country, state or city (API lists).
  withRank?: boolean;
  // The inactive players instead: the collector moves players who have not
  // played for a while to hlstats_PlayersInactive (same columns) and back
  // when they return. They have no place in the ranking (no globalRank).
  inactive?: boolean;
}) {
  const table = opts.inactive ? "hlstats_PlayersInactive" : "hlstats_Players";
  const where = [`p.game = ?`, `p.hideranking = 0`];
  const params: Param[] = [opts.game];
  if (opts.clan) {
    where.push(`p.clan = ?`);
    params.push(opts.clan);
  }
  if (opts.search) {
    where.push(`d.lastName ${likeOp()} ?`);
    params.push(like(opts.search));
  }
  if (opts.country) {
    where.push(`LOWER(l.flag) = ?`);
    params.push(opts.country);
  }
  if (opts.state) {
    where.push(`LOWER(l.state) = ?`);
    params.push(opts.state.toLowerCase());
  }
  if (opts.city) {
    where.push(`LOWER(l.city) = ?`);
    params.push(opts.city.toLowerCase());
  }
  const local = !!(opts.country || opts.state || opts.city);
  const joins = `LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
    LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id`;
  const from = `FROM ${local ? placeJoins(table) : `${table} p
    ${joins}`}
    WHERE ${where.join(" AND ")}`;
  const dir = opts.asc ? "ASC" : "DESC";
  // A ranking can have hundreds of thousands of players (an imported
  // HLstatsX database): the tie-breaker runs in the sort's direction, so the
  // indexes game_skill (game, hideranking, skill, playerId) and game_activity
  // (game, hideranking, last_event, playerId) serve the default orders, and a
  // page of inactive players sorted by a column of the players table is
  // picked by playerId first and only its rows are joined.
  const order = `${rankingSorts[opts.sort]} ${dir}, p.playerId ${dir}`;
  const narrow = opts.inactive && !opts.search && !local && rankingSorts[opts.sort].startsWith("p.");
  const cols = `SELECT p.playerId, d.lastName AS name, p.skill, p.last_event, d.first_connect, p.connection_time,
              p.kills, ${await careerKills()} AS careerKills, p.deaths, p.headshots, p.shots, p.hits, l.flag, l.country`;
  // Both joins match at most one row, so without a filter on them the count
  // needs the players table only.
  const countFrom = opts.search || local ? from : `FROM ${table} p WHERE ${where.join(" AND ")}`;
  const countSql = `SELECT COUNT(*) AS n ${countFrom}`;
  const [rows, count] = await Promise.all([
    narrow
      ? query<RankingRow>(
          `${cols}
           FROM (SELECT p.playerId FROM ${table} p WHERE ${where.join(" AND ")} ORDER BY ${order} LIMIT ? OFFSET ?) x
           JOIN ${table} p ON p.playerId = x.playerId
           ${joins}
           ORDER BY ${order}`,
          [...params, opts.limit, opts.offset],
        )
      : query<RankingRow>(`${cols} ${from} ORDER BY ${order} LIMIT ? OFFSET ?`, [...params, opts.limit, opts.offset]),
    // Counting the inactive players of a large ranking takes a while; the
    // number changes only when the collector moves players, so it is kept
    // for a minute (not while searching).
    opts.inactive && !opts.search ? inactiveCount(countSql, params) : queryOne<{ n: number }>(countSql, params),
  ]);
  if ((local || opts.withRank) && !opts.inactive) {
    const pos = await rankPositions(rows.map((r) => ({ game: opts.game, skill: r.skill })));
    for (const r of rows) r.globalRank = pos.get(`${opts.game}|${Number(r.skill)}`);
  }
  return { rows, total: count?.n ?? 0 };
}

const inactiveCountCache = new Map<string, { at: number; value: Promise<{ n: number } | undefined> }>();

function inactiveCount(sql: string, params: Param[]): Promise<{ n: number } | undefined> {
  const key = `${sql}|${JSON.stringify(params)}`;
  const hit = inactiveCountCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  if (inactiveCountCache.size > 200) inactiveCountCache.clear();
  const value = queryOne<{ n: number }>(sql, params);
  value.catch(() => inactiveCountCache.delete(key));
  inactiveCountCache.set(key, { at: Date.now(), value });
  return value;
}

// ---------------------------------------------------------------- countries, states and cities

// Countries, states and cities with ranked players, most players first (for
// the selects above the ranking), from the players per location (playerPlaces).
export type { PlaceOption } from "./place-counts";

export async function getCountryOptions(game: string): Promise<PlaceOption[]> {
  return placeOptions(await playerPlaces(game), "country");
}

export async function getStateOptions(game: string, country: string): Promise<PlaceOption[]> {
  return placeOptions(await playerPlaces(game), "state", country);
}

export async function getCityOptions(game: string, country: string): Promise<PlaceOption[]> {
  return placeOptions(await playerPlaces(game), "city", country);
}

// The players of a ranking per location, connect method and hidden state:
// one pass over all players (a second or more with hundreds of thousands)
// for the Misc page and the place selects together. Kept for ten minutes,
// then the old counts are still shown for up to a day while one reload runs
// in the background (ttl-cache.ts), so only the first view after a start
// waits. On MariaDB the player data is read in table order and the players
// by primary key (STRAIGHT_JOIN): about half the time of the other way round.
const placesCache = ttlCache<PlaceCount[]>(600_000, 86_400_000);

// From the ranking's players (index game_skill) to their data row, not the
// other way round: a reload read all 400,000 data rows before (458 ms,
// now 12 ms on the same database).
function playerPlaces(game: string): Promise<PlaceCount[]> {
  return placesCache(game, async () => {
    const straight = dialect() === "mariadb" ? "STRAIGHT_JOIN " : "";
    const rows = await query<{ lid: number | null; flag: string | null; country: string | null; state: string | null; city: string | null; type: number; hidden: number; n: number }>(
      `SELECT l.id AS lid, l.flag, l.country, l.state, l.city, x.type, x.hidden, x.n
       FROM (SELECT ${straight}d.location_id, d.connect_type AS type, CASE WHEN p.hideranking = 0 THEN 0 ELSE 1 END AS hidden, COUNT(*) AS n
             FROM hlstats_Players p
             JOIN hlstats_Players_Data d ON d.playerId = p.playerId
             WHERE p.game = ?
             GROUP BY d.location_id, d.connect_type, CASE WHEN p.hideranking = 0 THEN 0 ELSE 1 END) x
       LEFT JOIN hlstats_Players_Locations l ON l.id = x.location_id`,
      [game],
    );
    return rows.map((r) => ({
      flag: r.flag,
      country: r.country,
      state: r.state,
      city: r.city,
      located: r.lid !== null,
      type: Number(r.type),
      hidden: Number(r.hidden) !== 0,
      n: Number(r.n),
    }));
  });
}

// States are names, not the legacy region codes of HLstatsX (isStateName).
const STATE_NAME = `CHAR_LENGTH(l.state) > 3`;

// Ranking of countries, states or cities: summed and averaged player values.
export type PlaceRow = PlaceOption & {
  skill: number;
  avgSkill: number;
  kills: number;
  deaths: number;
  headshots: number;
  connection_time: number;
  last_event: number;
};

export { placeSorts, type PlaceSort } from "./sorts";

// A place ranking sums all players of the ranking (or of one country): the
// whole ordered list is read once and kept for ten minutes per ranking, kind,
// country and sort, then reloaded in the background for up to a day
// (ttl-cache.ts); the pages are slices of it.
const placeRankingCache = ttlCache<PlaceRow[]>(600_000, 86_400_000, 500);

export async function getPlaceRanking(opts: {
  game: string;
  kind: PlaceKind;
  country: string;
  sort: PlaceSort;
  asc: boolean;
  limit: number;
  offset: number;
}) {
  const { limit, offset, ...key } = opts;
  const all = await placeRankingCache(JSON.stringify(key), () => loadPlaceRanking(key));
  return { rows: all.slice(offset, offset + limit), total: all.length };
}

async function loadPlaceRanking(opts: { game: string; kind: PlaceKind; country: string; sort: PlaceSort; asc: boolean }): Promise<PlaceRow[]> {
  const where = [`p.game = ?`, `p.hideranking = 0`, `l.flag <> ''`];
  const params: Param[] = [opts.game];
  // States and cities are grouped within their country, so places with the
  // same name in two countries stay apart.
  const col = opts.kind === "state" ? "l.state" : opts.kind === "city" ? "l.city" : "";
  if (col) where.push(col === "l.state" ? STATE_NAME : `${col} <> ''`);
  if (opts.country) {
    where.push(`LOWER(l.flag) = ?`);
    params.push(opts.country);
  }
  const group = col ? `LOWER(l.flag), ${col}` : `LOWER(l.flag)`;
  const inner = `SELECT LOWER(l.flag) AS code, MAX(l.country) AS name,
      ${opts.kind === "state" ? "l.state" : "''"} AS state, ${opts.kind === "city" ? "l.city" : "''"} AS city,
      COUNT(*) AS players, SUM(p.skill) AS skill, ROUND(AVG(p.skill)) AS avgSkill,
      SUM(p.kills) AS kills, SUM(p.deaths) AS deaths, SUM(p.headshots) AS headshots,
      SUM(p.connection_time) AS connection_time, MAX(p.last_event) AS last_event
    FROM ${opts.country ? placeJoins("hlstats_Players") : `hlstats_Players p
    JOIN hlstats_Players_Data d ON d.playerId = p.playerId
    JOIN hlstats_Players_Locations l ON l.id = d.location_id`}
    WHERE ${where.join(" AND ")} GROUP BY ${group}`;
  const order = `${placeSorts[opts.sort]} ${opts.asc ? "ASC" : "DESC"}, code, state, city`;
  const rows = await query<PlaceRow>(`SELECT * FROM (${inner}) x ORDER BY ${order}`, params);
  return rows.map((r) => ({ ...r, players: Number(r.players), skill: Number(r.skill), avgSkill: Number(r.avgSkill), kills: Number(r.kills), deaths: Number(r.deaths), headshots: Number(r.headshots), connection_time: Number(r.connection_time) }));
}

export type PlayerDetail = {
  playerId: number;
  game: string;
  game_id: number;
  name: string | null;
  skill: number;
  last_skill_change: number;
  last_event: number;
  connection_time: number;
  kills: number;
  careerKills: number; // the kills of the career rank (careerKills)
  deaths: number;
  suicides: number;
  headshots: number;
  shots: number;
  hits: number;
  rounds: number;
  wins: number;
  losses: number;
  team_kills: number;
  kill_streak: number;
  kill_assists: number;
  kills_assisted: number;
  survived_count: number;
  hideranking: number;
  clan: number;
  clanTag: string | null;
  clanName: string | null;
  first_connect: number | null;
  last_connect: number | null;
  total_connects: number | null;
  average_ping: number | null;
  homepage: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  flag: string | null;
  uniqueId: string | null;
};

export async function getPlayer(id: number): Promise<PlayerDetail | undefined> {
  // Players that went inactive are moved to hlstats_PlayersInactive.
  for (const table of ["hlstats_Players", "hlstats_PlayersInactive"]) {
    const row = await queryOne<PlayerDetail>(
      `SELECT p.playerId, TRIM(p.game) AS game, p.game_id, d.lastName AS name, p.skill, p.last_skill_change,
              p.last_event, p.connection_time, p.kills, ${await careerKills()} AS careerKills, p.deaths, p.suicides, p.headshots, p.shots, p.hits,
              p.rounds, p.wins, p.losses, p.team_kills, p.kill_streak, p.kill_assists, p.kills_assisted,
              p.survived_count, p.hideranking, p.clan,
              c.tag AS clanTag, c.name AS clanName,
              d.first_connect, d.last_connect, d.total_connects, d.average_ping, d.homepage,
              l.city, l.state, l.country, l.flag,
              (SELECT u.uniqueId FROM hlstats_PlayerUniqueIds u WHERE u.playerId = p.playerId LIMIT 1) AS uniqueId
       FROM ${table} p
       LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
       LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id
       LEFT JOIN hlstats_Clans c ON c.clanId = p.clan
       WHERE p.playerId = ?`,
      [id],
    );
    if (row) return row;
  }
  return undefined;
}

export async function getRankedCount(game: string) {
  const r = await queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM hlstats_Players WHERE game = ? AND hideranking = 0`, [game]);
  return Number(r?.n ?? 0);
}

export async function getPlayerPosition(game: string, skill: number) {
  const r = await queryOne<{ n: number }>(
    `SELECT COUNT(*) + 1 AS n FROM hlstats_Players WHERE game = ? AND hideranking = 0 AND skill > ?`,
    [game, skill],
  );
  return r?.n ?? null;
}

// Average of the profile radar (radar.ts): the game's ranked players active
// in the last 14 days (rows in the daily history), their numerators and
// denominators summed per axis, so the page divides them into the pooled
// ratio. One query per game, cached for 5 minutes like the other helpers.
const radarCache = new Map<string, { at: number; value: Promise<RadarAverage> }>();

export function getRadarAverage(game: string): Promise<RadarAverage> {
  const hit = radarCache.get(game);
  if (hit && Date.now() - hit.at < 300_000) return hit.value;
  if (radarCache.size > 100) radarCache.clear();
  const value = loadRadarAverage(game);
  value.catch(() => radarCache.delete(game));
  radarCache.set(game, { at: Date.now(), value });
  return value;
}

async function loadRadarAverage(game: string): Promise<RadarAverage> {
  const cols = RADAR_KEYS.flatMap((k) => [`SUM(h.${RADAR_SQL[k].num}) AS ${k}_num`, `SUM(h.${RADAR_SQL[k].den}) AS ${k}_den`]);
  const r = await queryOne<Record<string, number | string | null>>(
    `SELECT COUNT(DISTINCT h.playerId) AS players, ${cols.join(", ")}
     FROM hlstats_Players_History h
     JOIN hlstats_Players p ON p.playerId = h.playerId AND p.hideranking = 0
     WHERE h.game = ? AND ${sinceDays("h.eventTime")}`,
    [game, 13],
  );
  const num = (v: number | string | null | undefined) => Number(v ?? 0);
  return {
    players: num(r?.players),
    ratios: Object.fromEntries(RADAR_KEYS.map((k) => [k, { num: num(r?.[`${k}_num`]), den: num(r?.[`${k}_den`]) }])) as RadarAverage["ratios"],
  };
}

export type HistoryDay = {
  eventTime: string;
  skill: number;
  skill_change: number;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  rounds: number;
  wins: number;
  survived_count: number;
  kill_assists: number;
  connection_time: number;
};

export function getPlayerHistory(id: number, days: number) {
  return query<HistoryDay>(
    `SELECT eventTime, skill, skill_change, kills, deaths, headshots, shots, hits, rounds, wins, survived_count,
            kill_assists, connection_time FROM hlstats_Players_History
     WHERE playerId = ? AND ${sinceDays("eventTime")} ORDER BY eventTime`,
    [id, days],
  );
}

// Points at the end of the last history day before the last `days` days
// (the start of the player trend), null if there is none.
export async function getPlayerSkillBefore(id: number, days: number): Promise<number | null> {
  const row = await queryOne<{ skill: number }>(
    `SELECT skill FROM hlstats_Players_History WHERE playerId = ? AND NOT (${sinceDays("eventTime")}) ORDER BY eventTime DESC LIMIT 1`,
    [id, days],
  );
  return row ? Number(row.skill) : null;
}

// ---------------------------------------------------------------- clan page: the members together

// The daily history of a group of players (a clan's members) added up per
// day over the last `days` days, for the clan page's summary and radar.
export function getMembersHistory(ids: number[], days: number) {
  if (!ids.length) return Promise.resolve([] as HistoryDay[]);
  return query<HistoryDay>(
    `SELECT eventTime, SUM(skill) AS skill, SUM(skill_change) AS skill_change, SUM(kills) AS kills, SUM(deaths) AS deaths,
            SUM(headshots) AS headshots, SUM(shots) AS shots, SUM(hits) AS hits, SUM(rounds) AS rounds, SUM(wins) AS wins,
            SUM(survived_count) AS survived_count, SUM(kill_assists) AS kill_assists, SUM(connection_time) AS connection_time
     FROM hlstats_Players_History
     WHERE playerId IN (?) AND ${sinceDays("eventTime")} GROUP BY eventTime ORDER BY eventTime`,
    [ids, days],
  ).then((rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, k === "eventTime" ? v : Number(v ?? 0)])) as HistoryDay));
}

export type PlayerName = {
  name: string;
  connection_time: number;
  lastuse: string | null;
  numuses: number;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
};

export function getPlayerNames(id: number) {
  return query<PlayerName>(
    `SELECT name, connection_time, lastuse, numuses, kills, deaths, headshots, shots, hits
     FROM hlstats_PlayerNames WHERE playerId = ? ORDER BY lastuse DESC LIMIT 20`,
    [id],
  );
}

export type PlayerWeapon = {
  weaponId: number;
  code: string;
  name: string;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  damage: number;
  head: number;
  neck: number;
  chest: number;
  stomach: number;
  leftarm: number;
  rightarm: number;
  leftleg: number;
  rightleg: number;
};

// hlstats_Players_Weapons.neck and its monthly archive come with collector
// migration 7 (Counter-Strike 2); older databases read 0. The pages look again
// for the columns every 5 minutes.
let neckCol: { ok: Promise<boolean>; at: number } | undefined;
async function neckOk() {
  if (!neckCol || (Date.now() - neckCol.at > 300_000 && !(await neckCol.ok))) {
    neckCol = {
      ok: query(`SELECT a.neck, b.neck FROM hlstats_Players_Weapons a, hlstats_Players_Weapons_History_Months b WHERE 1 = 0`).then(() => true, () => false),
      at: Date.now(),
    };
  }
  return neckCol.ok;
}

export async function getPlayerWeapons(id: number) {
  const neck = (await neckOk()) ? "neck" : "0 AS neck";
  const src = weeksAndMonths(
    "Players_Weapons",
    `weapon_id, kills, deaths, headshots, shots, hits, damage, head, ${neck}, chest, stomach, leftarm, rightarm, leftleg, rightleg`,
    "player_id = ?",
    [id],
  );
  return query<PlayerWeapon>(
    `SELECT w.weaponId, w.code, w.name, SUM(x.kills) AS kills, SUM(x.deaths) AS deaths,
            SUM(x.headshots) AS headshots, SUM(x.shots) AS shots, SUM(x.hits) AS hits, SUM(x.damage) AS damage,
            SUM(x.head) AS head, SUM(x.neck) AS neck, SUM(x.chest) AS chest, SUM(x.stomach) AS stomach, SUM(x.leftarm) AS leftarm,
            SUM(x.rightarm) AS rightarm, SUM(x.leftleg) AS leftleg, SUM(x.rightleg) AS rightleg
     FROM ${src.sql} x JOIN hlstats_Weapons w ON w.weaponId = x.weapon_id
     GROUP BY w.weaponId, w.code, w.name ORDER BY kills DESC, shots DESC, w.weaponId`,
    src.params,
  );
}

// The weapons of a group of players (a clan's members) added up, like
// getPlayerWeapons.
// The weekly rows and the monthly archive of every member: kept for five
// minutes per group (ttl-cache.ts).
const membersWeaponsCache = ttlCache<PlayerWeapon[]>(300_000, 3_600_000, 200);

export function getMembersWeapons(ids: number[]): Promise<PlayerWeapon[]> {
  if (!ids.length) return Promise.resolve([] as PlayerWeapon[]);
  return membersWeaponsCache(ids.join(","), () => loadMembersWeapons(ids));
}

async function loadMembersWeapons(ids: number[]) {
  const neck = (await neckOk()) ? "neck" : "0 AS neck";
  const src = weeksAndMonths(
    "Players_Weapons",
    `weapon_id, kills, deaths, headshots, shots, hits, damage, head, ${neck}, chest, stomach, leftarm, rightarm, leftleg, rightleg`,
    "player_id IN (?)",
    [ids],
  );
  return query<PlayerWeapon>(
    `SELECT w.weaponId, w.code, w.name, SUM(x.kills) AS kills, SUM(x.deaths) AS deaths,
            SUM(x.headshots) AS headshots, SUM(x.shots) AS shots, SUM(x.hits) AS hits, SUM(x.damage) AS damage,
            SUM(x.head) AS head, SUM(x.neck) AS neck, SUM(x.chest) AS chest, SUM(x.stomach) AS stomach, SUM(x.leftarm) AS leftarm,
            SUM(x.rightarm) AS rightarm, SUM(x.leftleg) AS leftleg, SUM(x.rightleg) AS rightleg
     FROM ${src.sql} x JOIN hlstats_Weapons w ON w.weaponId = x.weapon_id
     GROUP BY w.weaponId, w.code, w.name ORDER BY kills DESC, shots DESC, w.weaponId`,
    src.params,
  );
}

export type PlayerMap = { id: number; map: string; kills: number; deaths: number; headshots: number };

// Per-map kills and deaths from hlstats_Events_Frags (the collector writes
// only shots and hits to hlstats_Players_Maps). A pass over all frags of the
// player, so kept for five minutes per player (ttl-cache.ts).
const playerMapsCache = ttlCache<PlayerMap[]>(300_000, 3_600_000, 1000);

// Without bots in the stats of the ranking, frags with its bots are left out.
export async function getPlayerMaps(game: string, id: number, limit = 25): Promise<PlayerMap[]> {
  const bots = await botFragIds(game);
  return playerMapsCache(`${id}|${limit}|${bots.join(",")}`, () =>
    query<PlayerMap>(
      `SELECT m.id, m.map, SUM(x.k) AS kills, SUM(x.d) AS deaths, SUM(x.hs) AS headshots
       FROM (SELECT map, 1 AS k, 0 AS d, CASE WHEN headshot > 0 THEN 1 ELSE 0 END AS hs FROM hlstats_Events_Frags WHERE killerId = ?${notIn("victimId", bots)}
             UNION ALL
             SELECT map, 0, 1, 0 FROM hlstats_Events_Frags WHERE victimId = ?${notIn("killerId", bots)}) x
       JOIN hlstats_Maps m ON m.id = x.map
       GROUP BY m.id, m.map ORDER BY kills DESC, deaths DESC, m.id LIMIT ?`,
      [id, ...ids(bots), id, ...ids(bots), limit],
    ),
  );
}

// The bots of a ranking while kills with bots do not count in its stats
// (gamewe_bot_stats_<game> off, the default): the tables summed from the
// frags (maps and opponents of a player or clan, the players of a map) leave
// their frags out, as the collector leaves them out of the players' counts.
// Empty when they count. A ranking has few bots, so the ids go into the
// query as a list.
const botFragCache = ttlCache<number[]>(60_000, 600_000, 100);
export async function botFragIds(game: string): Promise<number[]> {
  if ((await botRankings()).stats(game)) return [];
  return botFragCache(game, async () =>
    (await query<{ playerId: number }>(`SELECT DISTINCT playerId FROM hlstats_PlayerUniqueIds WHERE game = ? AND uniqueId LIKE 'BOT:%' ORDER BY playerId`, [game])).map((r) =>
      Number(r.playerId),
    ),
  );
}
const notIn = (col: string, bots: number[]) => (bots.length ? ` AND ${col} NOT IN (?)` : "");
const ids = (bots: number[]): Param[] => (bots.length ? [bots] : []);

// Per-map kills and deaths of a group of players (a clan's members), like
// getPlayerMaps. A kill between two members counts as a kill and a death.
// The frags of every member: kept for five minutes per group (ttl-cache.ts).
const membersMapsCache = ttlCache<PlayerMap[]>(300_000, 3_600_000, 200);

export async function getMembersMaps(game: string, members: number[], limit = 15): Promise<PlayerMap[]> {
  if (!members.length) return [];
  const bots = await botFragIds(game);
  return membersMapsCache(`${limit}|${members.join(",")}|${bots.join(",")}`, () =>
    query<PlayerMap>(
      `SELECT m.id, m.map, SUM(x.k) AS kills, SUM(x.d) AS deaths, SUM(x.hs) AS headshots
       FROM (SELECT map, 1 AS k, 0 AS d, CASE WHEN headshot > 0 THEN 1 ELSE 0 END AS hs FROM hlstats_Events_Frags WHERE killerId IN (?)${notIn("victimId", bots)}
             UNION ALL
             SELECT map, 0, 1, 0 FROM hlstats_Events_Frags WHERE victimId IN (?)${notIn("killerId", bots)}) x
       JOIN hlstats_Maps m ON m.id = x.map
       GROUP BY m.id, m.map ORDER BY kills DESC, deaths DESC, m.id LIMIT ?`,
      [members, ...ids(bots), members, ...ids(bots), limit],
    ),
  );
}

export type PlayerTeamRow = { id: number; name: string; joined: number };

// How often the player joined each team, from hlstats_Events_ChangeTeam.
export function getPlayerTeams(id: number) {
  return query<PlayerTeamRow>(
    `SELECT t.teamId AS id, t.name, COUNT(*) AS joined
     FROM hlstats_Events_ChangeTeam e JOIN hlstats_Teams t ON t.teamId = e.team
     WHERE e.playerId = ? GROUP BY t.teamId, t.name ORDER BY joined DESC, t.teamId`,
    [id],
  );
}

export type PlayerAction = { id: number; description: string; count: number; points: number };

export function getPlayerActions(id: number) {
  const src = weeksAndMonths("Players_Actions", "action_id, count, points", "player_id = ?", [id]);
  return query<PlayerAction>(
    `SELECT a.id, a.description, SUM(x.count) AS count, SUM(x.points) AS points
     FROM ${src.sql} x JOIN hlstats_Actions a ON a.id = x.action_id
     GROUP BY a.id, a.description ORDER BY count DESC, a.id`,
    src.params,
  );
}

export type Opponent = { playerId: number; name: string | null; kills: number; headshots: number };

// The victims, the killers and the kill statistics of a player all come from
// one pass over the player's frags (the killer_time and victim_time indexes),
// summed per opponent: kills and headshots against the opponent, deaths by
// the opponent and the headshots among them. A player with a long history
// has hundreds of thousands of frags, so the three lists are kept together
// for five minutes per player (ttl-cache.ts); the positions in the ranking
// are looked up live.
type OpponentSums = { victims: Opponent[]; killers: Opponent[]; kills: (Omit<KillStat, "position"> & { skill: number; game: string })[] };
const opponentsCache = ttlCache<OpponentSums>(300_000, 3_600_000, 1000);

// Rows shown: the ten most frequent on each side, the kill statistics with
// at least `min` kills, at most `limit` of them.
const OPPONENTS = 10;
const KILL_STATS_MIN = 5;
const KILL_STATS = 50;

// Without bots in the stats of the ranking (botFragIds), its bots are no
// opponents.
async function opponentSums(game: string, id: number): Promise<OpponentSums> {
  const bots = await botFragIds(game);
  return opponentsCache(`${id}|${bots.join(",")}`, () => loadOpponentSums(id, bots));
}

async function loadOpponentSums(id: number, bots: number[]): Promise<OpponentSums> {
  // Summed per opponent first, then joined: the names and the ranking rows
  // once per opponent, not per frag. hidden is hiddenSql on the joined row:
  // a hidden player who is not a bot; a player without a ranking row
  // (deleted, inactive) is not hidden.
  const rows = await query<{ playerId: number; name: string | null; kills: number; deaths: number; kHs: number; dHs: number; hidden: number; hideranking: number | null; skill: number | null; game: string | null }>(
    `SELECT o.playerId, d.lastName AS name, o.kills, o.deaths, o.kHs, o.dHs, p.hideranking, p.skill, TRIM(p.game) AS game,
            CASE WHEN p.hideranking <> 0 AND NOT ${isBotSql("o.playerId")} THEN 1 ELSE 0 END AS hidden
     FROM (SELECT u.playerId, SUM(u.k) AS kills, SUM(u.d) AS deaths, SUM(u.khs) AS kHs, SUM(u.dhs) AS dHs
           FROM (SELECT victimId AS playerId, 1 AS k, 0 AS d, CASE WHEN headshot > 0 THEN 1 ELSE 0 END AS khs, 0 AS dhs
                 FROM hlstats_Events_Frags WHERE killerId = ? AND victimId <> killerId${notIn("victimId", bots)}
                 UNION ALL
                 SELECT killerId AS playerId, 0 AS k, 1 AS d, 0 AS khs, CASE WHEN headshot > 0 THEN 1 ELSE 0 END AS dhs
                 FROM hlstats_Events_Frags WHERE victimId = ? AND victimId <> killerId${notIn("killerId", bots)}) u
           GROUP BY u.playerId) o
     LEFT JOIN hlstats_Players p ON p.playerId = o.playerId
     LEFT JOIN hlstats_Players_Data d ON d.playerId = o.playerId`,
    [id, ...ids(bots), id, ...ids(bots)],
  );
  const all = rows.map((r) => ({
    playerId: Number(r.playerId),
    name: r.name,
    kills: Number(r.kills),
    deaths: Number(r.deaths),
    kHs: Number(r.kHs),
    dHs: Number(r.dHs),
    hidden: Number(r.hidden) === 1,
    ranked: r.hideranking !== null,
    hideranking: Number(r.hideranking ?? 0),
    skill: Number(r.skill ?? 0),
    game: r.game ?? "",
  }));
  // Most frequent first, ties by lowest id, like the single queries before.
  const top = (count: (o: (typeof all)[number]) => number) =>
    all
      .filter((o) => !o.hidden && count(o) > 0)
      .sort((a, b) => count(b) - count(a) || a.playerId - b.playerId)
      .slice(0, OPPONENTS);
  return {
    victims: top((o) => o.kills).map((o) => ({ playerId: o.playerId, name: o.name, kills: o.kills, headshots: o.kHs })),
    killers: top((o) => o.deaths).map((o) => ({ playerId: o.playerId, name: o.name, kills: o.deaths, headshots: o.dHs })),
    // Only opponents with a ranking row (as before: the page shows their place
    // in the ranking and whether they are hidden).
    kills: all
      .filter((o) => o.ranked && o.kills >= KILL_STATS_MIN)
      .sort((a, b) => b.kills - a.kills || a.playerId - b.playerId)
      .slice(0, KILL_STATS)
      .map((o) => ({ playerId: o.playerId, name: o.name, kills: o.kills, deaths: o.deaths, headshots: o.kHs, hideranking: o.hideranking, skill: o.skill, game: o.game })),
  };
}

// The ten players this player killed most often (victims: kills and
// headshots against them) or who killed this player most often (killers:
// their kills and headshots). Hidden opponents are left out.
export async function getOpponents(game: string, id: number, as: "victims" | "killers"): Promise<Opponent[]> {
  return (await opponentSums(game, id))[as];
}

export type KillStat = { playerId: number; name: string | null; kills: number; deaths: number; headshots: number; hideranking: number; position: number | null };

// Player kill statistics as on gameME: everyone this player killed at least
// five times, with the kills against and deaths by each, and the other
// player's position in the ranking (none when hidden).
export async function getPlayerKillStats(game: string, id: number): Promise<KillStat[]> {
  const rows = (await opponentSums(game, id)).kills;
  // The positions (rankPositions) only for the rows shown, and live.
  const pos = await rankPositions(rows.filter((r) => r.hideranking === 0));
  return rows.map(({ skill, game, ...r }) => ({
    ...r,
    position: r.hideranking === 0 ? (pos.get(`${game}|${skill}`) ?? null) : null,
  }));
}

export type PlayerAward = { code: string; name: string; verb: string; date: string; winner_count: number };

export function getPlayerAwards(id: number) {
  return query<PlayerAward>(
    `SELECT a.code, a.name, a.verb, h.date, h.winner_count FROM hlstats_Awards_History h
     JOIN hlstats_Awards a ON a.awardId = h.award_id
     WHERE h.winner_id = ? ORDER BY h.date DESC LIMIT 20`,
    [id],
  );
}

export type RankDef = { name: string; minimum: number };

export function getRankDefinitions(game: string) {
  return query<RankDef>(
    `SELECT name, minimum FROM hlstats_Definition_Ranks_Ribbons
     WHERE game_code = ? AND definition_type LIKE 'rank%' ORDER BY minimum`,
    [game],
  );
}

// ---------------------------------------------------------------- chat

export type ChatRow = {
  timestamp_id: number;
  playerId: number;
  name: string | null;
  message_mode: number;
  message: string;
  server: string | null;
};

// Chat is personal data: read with the admin database user (the public one
// may have no access), and shown publicly only when gamewe_chat_public is on.
// shown: public pages, without the lines of hidden players (the admin chat
// keeps them).
function chatWhere(opts: { game?: string; playerId?: number; serverId?: number; search?: string; shown?: boolean }) {
  const where: string[] = [];
  const params: Param[] = [];
  if (opts.shown) where.push(`NOT ${hiddenSql("c.playerId")}`);
  if (opts.game) {
    where.push(`c.game_id = (SELECT id FROM hlstats_Games WHERE code = ?)`);
    params.push(opts.game);
  }
  if (opts.playerId) {
    where.push(`c.playerId = ?`);
    params.push(opts.playerId);
  }
  if (opts.serverId) {
    where.push(`c.server_id = ?`);
    params.push(opts.serverId);
  }
  if (opts.search) {
    where.push(`(c.message ${likeOp()} ? OR d.lastName ${likeOp()} ?)`);
    params.push(like(opts.search), like(opts.search));
  }
  return { where, params };
}

// Newest first; asc: oldest first (the only order: chat can be large).
export async function getChat(opts: { game?: string; playerId?: number; serverId?: number; search?: string; shown?: boolean; limit: number; offset: number; asc?: boolean }) {
  const { where, params } = chatWhere(opts);
  return adminQuery<ChatRow>(
    `SELECT c.timestamp_id, c.playerId, d.lastName AS name, c.message_mode, c.message, s.name AS server
     FROM hlstats_Events_Chat c
     LEFT JOIN hlstats_Players_Data d ON d.playerId = c.playerId
     LEFT JOIN hlstats_Servers s ON s.serverId = c.server_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY c.timestamp_id ${opts.asc ? "ASC" : "DESC"}, c.playerId LIMIT ? OFFSET ?`,
    [...params, opts.limit, opts.offset],
  );
}

// Number of chat lines for the same filter (pager).
// The count of a ranking's chat reads every line of the ranking
// (hlstats_Events_Chat has no index on the ranking): kept for a minute per
// filter; a search is counted every time.
const chatCountCache = ttlCache<number>(60_000, 600_000, 500);

export function countChat(opts: { game?: string; playerId?: number; serverId?: number; search?: string; shown?: boolean }): Promise<number> {
  if (opts.search) return loadChatCount(opts);
  return chatCountCache(JSON.stringify([opts.game, opts.playerId, opts.serverId, !!opts.shown]), () => loadChatCount(opts));
}

async function loadChatCount(opts: { game?: string; playerId?: number; serverId?: number; search?: string; shown?: boolean }) {
  const { where, params } = chatWhere(opts);
  const [r] = await adminQuery<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM hlstats_Events_Chat c
     ${opts.search ? "LEFT JOIN hlstats_Players_Data d ON d.playerId = c.playerId" : ""}
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}`,
    params,
  );
  return Number(r?.n ?? 0);
}

// ---------------------------------------------------------------- clans

export type ClanRow = {
  clanId: number;
  tag: string;
  name: string;
  homepage: string;
  flag: string;
  members: number;
  skill: number;
  kills: number;
  deaths: number;
  headshots: number;
  connection_time: number;
  last_event: number;
};

const clanAgg = `COUNT(p.playerId) AS members, ROUND(AVG(p.skill)) AS skill, SUM(p.kills) AS kills,
  SUM(p.deaths) AS deaths, SUM(p.headshots) AS headshots, SUM(p.connection_time) AS connection_time,
  MAX(p.last_event) AS last_event`;

export const clanSorts = {
  skill: "skill",
  members: "members",
  kills: "kills",
  deaths: "deaths",
  headshots: "headshots",
  kpd: "kills * 1.0 / GREATEST(deaths, 1)",
  hpk: "headshots * 1.0 / GREATEST(kills, 1)",
  time: "connection_time",
  activity: "last_event",
  tag: "tag",
} as const;
export type ClanSort = keyof typeof clanSorts;

// A page of the clan list sums every member of every clan of the ranking:
// kept for a minute per page and order, the count too (ttl-cache.ts).
const clansCache = ttlCache<ClanRow[]>(60_000, 600_000, 500);
const clanCountCache = ttlCache<number>(60_000, 600_000, 100);

export function getClans(game: string, limit: number, offset: number, sort: ClanSort = "skill", asc = false): Promise<ClanRow[]> {
  return clansCache(`${game}|${limit}|${offset}|${sort}|${asc}`, () =>
    query<ClanRow>(
      `SELECT * FROM (SELECT c.clanId, c.tag, c.name, c.homepage, c.flag, ${clanAgg}
         FROM hlstats_Clans c JOIN hlstats_Players p ON p.clan = c.clanId AND p.hideranking = 0
         WHERE c.game = ? GROUP BY c.clanId, c.tag, c.name, c.homepage, c.flag
         HAVING COUNT(p.playerId) >= 2) x
       ORDER BY ${clanSorts[sort]} ${asc ? "ASC" : "DESC"}, clanId LIMIT ? OFFSET ?`,
      [game, limit, offset],
    ),
  );
}

export function countClans(game: string): Promise<number> {
  return clanCountCache(game, () => loadClanCount(game));
}

async function loadClanCount(game: string) {
  const r = await queryOne<{ n: number | string }>(
    `SELECT COUNT(*) AS n FROM (SELECT c.clanId FROM hlstats_Clans c JOIN hlstats_Players p ON p.clan = c.clanId AND p.hideranking = 0
     WHERE c.game = ? GROUP BY c.clanId HAVING COUNT(p.playerId) >= 2) x`,
    [game],
  );
  return Number(r?.n ?? 0);
}

// Inactive clans: clans with at least two visible members of whom fewer
// than two are still active, because the collector moved the others to
// hlstats_PlayersInactive. So every clan with two or more members is in
// exactly one of the two lists. Their numbers are over all their members.
function clanMembersOf(cols: string) {
  return `(SELECT ${cols}, 1 AS active FROM hlstats_Players WHERE game = ? AND hideranking = 0 AND clan > 0
     UNION ALL SELECT ${cols}, 0 AS active FROM hlstats_PlayersInactive WHERE game = ? AND hideranking = 0 AND clan > 0)`;
}

const inactiveClansFrom = `FROM hlstats_Clans c
  JOIN ${clanMembersOf("playerId, clan, skill, kills, deaths, headshots, connection_time, last_event")} p ON p.clan = c.clanId
  WHERE c.game = ? GROUP BY c.clanId, c.tag, c.name, c.homepage, c.flag
  HAVING COUNT(p.playerId) >= 2 AND SUM(p.active) < 2`;

export function getInactiveClans(game: string, limit: number, offset: number, sort: ClanSort = "activity", asc = false) {
  return query<ClanRow>(
    `SELECT * FROM (SELECT c.clanId, c.tag, c.name, c.homepage, c.flag, ${clanAgg} ${inactiveClansFrom}) x
     ORDER BY ${clanSorts[sort]} ${asc ? "ASC" : "DESC"}, clanId LIMIT ? OFFSET ?`,
    [game, game, game, limit, offset],
  );
}

// Reads all inactive players of the game, so kept for a minute like the
// count of the inactive players.
export async function countInactiveClans(game: string) {
  const r = await inactiveCount(`SELECT COUNT(*) AS n FROM (SELECT c.clanId ${inactiveClansFrom}) x`, [game, game, game]);
  return Number(r?.n ?? 0);
}

export function getClan(id: number) {
  return queryOne<ClanRow & { game: string }>(
    `SELECT c.clanId, c.tag, c.name, c.homepage, c.flag, TRIM(c.game) AS game, ${clanAgg}
     FROM hlstats_Clans c LEFT JOIN hlstats_Players p ON p.clan = c.clanId AND p.hideranking = 0
     WHERE c.clanId = ? GROUP BY c.clanId, c.tag, c.name, c.homepage, c.flag, c.game`,
    [id],
  );
}

export function getClanMembers(id: number) {
  return query<RankingRow>(
    `SELECT p.playerId, d.lastName AS name, p.skill, p.last_event, d.first_connect, p.connection_time,
            p.kills, p.deaths, p.headshots, p.shots, p.hits, l.flag, l.country
     FROM hlstats_Players p
     LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id
     WHERE p.clan = ? AND p.hideranking = 0 ORDER BY p.skill DESC`,
    [id],
  );
}

// The members the collector moved to hlstats_PlayersInactive, last seen first.
export function getInactiveClanMembers(id: number) {
  return query<RankingRow>(
    `SELECT p.playerId, d.lastName AS name, p.skill, p.last_event, d.first_connect, p.connection_time,
            p.kills, p.deaths, p.headshots, p.shots, p.hits, l.flag, l.country
     FROM hlstats_PlayersInactive p
     LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id
     WHERE p.clan = ? AND p.hideranking = 0 ORDER BY p.last_event DESC`,
    [id],
  );
}

// ---------------------------------------------------------------- weapons, actions, maps, teams

export type WeaponRow = { weaponId: number; code: string; name: string; modifier: number; kills: number; headshots: number };

export function getWeapons(game: string) {
  return query<WeaponRow>(
    `SELECT weaponId, code, name, modifier, kills, headshots FROM hlstats_Weapons
     WHERE game = ? AND kills > 0 ORDER BY kills DESC, weaponId`,
    [game],
  );
}

export function getWeapon(game: string, code: string) {
  return queryOne<WeaponRow>(
    `SELECT weaponId, code, name, modifier, kills, headshots FROM hlstats_Weapons WHERE game = ? AND code = ?`,
    [game, code],
  );
}

export type TopRow = { playerId: number; name: string | null; a: number; b: number; c: number; d: number };

// Best players for one weapon: a = kills, b = headshots, c = shots, d = hits.
export function getWeaponTop(weaponId: number, limit = 50, offset = 0) {
  const src = weeksAndMonths("Players_Weapons", "player_id, kills, headshots, shots, hits", "weapon_id = ?", [weaponId]);
  return query<TopRow>(
    `SELECT x.player_id AS playerId, d.lastName AS name, SUM(x.kills) AS a, SUM(x.headshots) AS b,
            SUM(x.shots) AS c, SUM(x.hits) AS d
     FROM ${src.sql} x
     JOIN hlstats_Players p ON p.playerId = x.player_id AND p.hideranking = 0
     LEFT JOIN hlstats_Players_Data d ON d.playerId = x.player_id
     GROUP BY x.player_id, d.lastName HAVING SUM(x.kills) > 0 ORDER BY a DESC, x.player_id LIMIT ? OFFSET ?`,
    [...src.params, limit, offset],
  );
}

// Number of players getWeaponTop can list (for paging).
export async function countWeaponTop(weaponId: number) {
  const src = weeksAndMonths("Players_Weapons", "player_id, kills", "weapon_id = ?", [weaponId]);
  const r = await queryOne<{ n: number }>(
    `SELECT COUNT(*) AS n FROM (SELECT x.player_id FROM ${src.sql} x
       JOIN hlstats_Players p ON p.playerId = x.player_id AND p.hideranking = 0
       GROUP BY x.player_id HAVING SUM(x.kills) > 0) y`,
    src.params,
  );
  return Number(r?.n ?? 0);
}

export type ActionRow = {
  id: number;
  code: string;
  description: string;
  reward_player: number;
  reward_team: number;
  team: string;
  count: number;
};

export function getActions(game: string) {
  return query<ActionRow>(
    `SELECT id, code, description, reward_player, reward_team, team, count FROM hlstats_Actions
     WHERE game = ? AND count > 0 ORDER BY count DESC, id`,
    [game],
  );
}

export function getAction(id: number) {
  return queryOne<ActionRow & { game: string }>(
    `SELECT id, code, description, reward_player, reward_team, team, count, TRIM(game) AS game
     FROM hlstats_Actions WHERE id = ?`,
    [id],
  );
}

// Best players for one action: a = count, b = points.
export function getActionTop(actionId: number) {
  const src = weeksAndMonths("Players_Actions", "player_id, count, points", "action_id = ?", [actionId]);
  return query<TopRow>(
    `SELECT x.player_id AS playerId, d.lastName AS name, SUM(x.count) AS a, SUM(x.points) AS b, 0 AS c, 0 AS d
     FROM ${src.sql} x
     JOIN hlstats_Players p ON p.playerId = x.player_id AND p.hideranking = 0
     LEFT JOIN hlstats_Players_Data d ON d.playerId = x.player_id
     GROUP BY x.player_id, d.lastName ORDER BY a DESC, x.player_id LIMIT 50`,
    src.params,
  );
}

export type MapRow = {
  id: number;
  map: string;
  kills: number;
  headshots: number;
  teamkills: number;
  teama_wins: number;
  teamb_wins: number;
  played: number;
  play_time: number;
  rounds: number;
};

const mapCols = `id, map, kills, headshots, teamkills, teama_wins, teamb_wins, played, play_time, rounds`;

export function getMaps(game: string) {
  return query<MapRow>(
    `SELECT ${mapCols} FROM hlstats_Maps WHERE game = ? AND (kills > 0 OR played > 0) ORDER BY kills DESC, id`,
    [game],
  );
}

// Round wins per map of a ranking and side (CT, T), from the round-won
// events: hlstats_Events_TeamBonuses has one row per winning player, the
// side is the team of the trigger's action (CTs_Win, Target_Bombed …), so
// rows with the same map and time are one round. hlstats_Maps.teama_wins /
// teamb_wins are not written by the collector. Games whose round actions
// have no side (TF2, DoD:S) and rounds without a team reward give no wins.
// One pass over the events of the ranking's maps, kept for 10 minutes, then
// the old wins are shown while one reload runs in the background
// (ttl-cache.ts).
const mapWinsCache = ttlCache<Map<number, { ct: number; t: number }>>(600_000, 86_400_000, 100);

export function getMapWins(game: string): Promise<Map<number, { ct: number; t: number }>> {
  return mapWinsCache(game, () =>
    query<{ map: number; team: string; wins: number }>(
      `SELECT r.map, r.team, COUNT(*) AS wins
       FROM (SELECT e.map, UPPER(a.team) AS team, e.timestamp_id
             FROM hlstats_Events_TeamBonuses e
             JOIN hlstats_Maps m ON m.id = e.map AND m.game = ?
             JOIN hlstats_Actions a ON a.id = e.actionId
             WHERE UPPER(a.team) IN ('CT', 'TERRORIST')
             GROUP BY e.map, UPPER(a.team), e.timestamp_id) r
       GROUP BY r.map, r.team`,
      [game],
    ).then(winsByMap),
  );
}

export function getMap(id: number) {
  return queryOne<MapRow & { game: string }>(`SELECT ${mapCols}, TRIM(game) AS game FROM hlstats_Maps WHERE id = ?`, [id]);
}

// Best players on one map over the last `days` days, from hlstats_Events_Frags:
// a = kills, b = deaths, c = headshots.
export function getMapTop(mapId: number, days: number, limit = 50, offset = 0) {
  const since = nowUnix() - days * 86400;
  return query<TopRow>(
    `SELECT x.playerId, d.lastName AS name, SUM(x.k) AS a, SUM(x.dd) AS b, SUM(x.hs) AS c, 0 AS d
     FROM (SELECT killerId AS playerId, 1 AS k, 0 AS dd, CASE WHEN headshot > 0 THEN 1 ELSE 0 END AS hs FROM hlstats_Events_Frags
           WHERE timestamp_id >= ? AND map = ?
           UNION ALL
           SELECT victimId, 0, 1, 0 FROM hlstats_Events_Frags WHERE timestamp_id >= ? AND map = ?) x
     JOIN hlstats_Players p ON p.playerId = x.playerId AND p.hideranking = 0
     LEFT JOIN hlstats_Players_Data d ON d.playerId = x.playerId
     GROUP BY x.playerId, d.lastName HAVING SUM(x.k) > 0 ORDER BY a DESC, x.playerId LIMIT ? OFFSET ?`,
    [since, mapId, since, mapId, limit, offset],
  );
}

// Number of players getMapTop can list (for paging).
export async function countMapTop(mapId: number, days: number) {
  const since = nowUnix() - days * 86400;
  const r = await queryOne<{ n: number }>(
    `SELECT COUNT(DISTINCT f.killerId) AS n FROM hlstats_Events_Frags f
     JOIN hlstats_Players p ON p.playerId = f.killerId AND p.hideranking = 0
     WHERE f.timestamp_id >= ? AND f.map = ?`,
    [since, mapId],
  );
  return Number(r?.n ?? 0);
}

// ---------------------------------------------------------------- map page

// Players of one map over all time, from hlstats_Events_Frags (index on
// map): kills and headshots as killer, deaths as victim. Only players with
// a kill on the map, hidden players (hideranking <> 0) left out. Sort keys
// (mapSort) map to fixed SQL expressions; desc: biggest first (for
// "position": the best place first, i.e. the most points).
export type MapPlayerRow = { playerId: number; name: string | null; skill: number; kills: number; deaths: number; headshots: number };

const MAP_PLAYER_SORTS: Record<MapSort, string> = {
  kills: "SUM(x.k)",
  deaths: "SUM(x.dd)",
  kpd: "CASE WHEN SUM(x.dd) > 0 THEN SUM(x.k) * 1.0 / SUM(x.dd) ELSE SUM(x.k) END",
  hs: "SUM(x.hs)",
  hpk: "SUM(x.hs) * 1.0 / SUM(x.k)",
  name: "d.lastName",
  position: "p.skill",
};

// Without bots in the stats of the ranking (botFragIds), frags with its bots
// are left out.
const mapPlayerFrom = (bots: number[]) => `FROM (SELECT killerId AS playerId, 1 AS k, 0 AS dd, CASE WHEN headshot > 0 THEN 1 ELSE 0 END AS hs FROM hlstats_Events_Frags WHERE map = ?${notIn("victimId", bots)}
           UNION ALL
           SELECT victimId, 0, 1, 0 FROM hlstats_Events_Frags WHERE map = ?${notIn("killerId", bots)}) x
     JOIN hlstats_Players p ON p.playerId = x.playerId AND p.hideranking = 0`;

// A page of the map's players sums every frag on the map: kept for two
// minutes per map, order and page (ttl-cache.ts); the places in the ranking
// (rankPositions) are looked up live.
const mapTableCache = ttlCache<MapPlayerRow[]>(120_000, 600_000, 500);
const mapKillersCache = ttlCache<{ players: number; hiddenKills: number }>(120_000, 600_000, 500);

// rank: the player's place in the whole ranking (rankPositions).
export async function getMapPlayerTable(game: string, mapId: number, sort: MapSort, desc: boolean, limit: number, offset: number) {
  const expr = MAP_PLAYER_SORTS[Object.hasOwn(MAP_PLAYER_SORTS, sort) ? sort : "kills"];
  const dir = desc ? "DESC" : "ASC";
  const bots = await botFragIds(game);
  const rows = await mapTableCache(`${mapId}|${expr}|${dir}|${limit}|${offset}|${bots.join(",")}`, async () =>
    (
      await query<MapPlayerRow>(
        `SELECT x.playerId, d.lastName AS name, p.skill, SUM(x.k) AS kills, SUM(x.dd) AS deaths, SUM(x.hs) AS headshots
         ${mapPlayerFrom(bots)}
         LEFT JOIN hlstats_Players_Data d ON d.playerId = x.playerId
         GROUP BY x.playerId, d.lastName, p.skill HAVING SUM(x.k) > 0
         ORDER BY ${expr} ${dir}, x.playerId LIMIT ? OFFSET ?`,
        [mapId, ...ids(bots), mapId, ...ids(bots), limit, offset],
      )
    ).map((r) => ({ ...r, playerId: Number(r.playerId), skill: Number(r.skill), kills: Number(r.kills), deaths: Number(r.deaths), headshots: Number(r.headshots) })),
  );
  const pos = await rankPositions(rows.map((r) => ({ game, skill: r.skill })));
  return rows.map((r) => ({ ...r, rank: pos.get(`${game}|${r.skill}`) }));
}

// Kills on one map by visible players (rows of getMapPlayerTable, for
// paging) and by hidden ones (hideranking <> 0, counted, not listed).
export async function countMapKillers(game: string, mapId: number): Promise<{ players: number; hiddenKills: number }> {
  const bots = await botFragIds(game);
  return mapKillersCache(`${mapId}|${bots.join(",")}`, () => loadMapKillers(mapId, bots));
}

async function loadMapKillers(mapId: number, bots: number[]) {
  const r = await queryOne<{ shown: number; hidden: number }>(
    `SELECT COUNT(DISTINCT CASE WHEN p.hideranking = 0 THEN f.killerId END) AS shown,
            SUM(CASE WHEN p.hideranking <> 0 THEN 1 ELSE 0 END) AS hidden
     FROM hlstats_Events_Frags f JOIN hlstats_Players p ON p.playerId = f.killerId
     WHERE f.map = ?${notIn("f.victimId", bots)}`,
    [mapId, ...ids(bots)],
  );
  return { players: Number(r?.shown ?? 0), hiddenKills: Number(r?.hidden ?? 0) };
}

// Seconds one map ran with players, from hlstats_server_load (one row per
// server and interval with the map of that moment): each row with a player
// counts the time since the server's previous row, at most
// LOAD_INTERVAL_MAX; a server's first row counts nothing. The window runs
// over every load row of the map's servers: kept for ten minutes per map
// (ttl-cache.ts).
const mapLoadCache = ttlCache<number>(600_000, 86_400_000, 500);

export function getMapLoadTime(mapId: number): Promise<number> {
  return mapLoadCache(String(mapId), () => loadMapLoadTime(mapId));
}

async function loadMapLoadTime(mapId: number): Promise<number> {
  const r = await queryOne<{ t: number | null }>(
    `SELECT SUM(LEAST(x.gap, ${LOAD_INTERVAL_MAX})) AS t
     FROM (SELECT l.map, l.max_players, l.timestamp - LAG(l.timestamp) OVER (PARTITION BY l.server_id ORDER BY l.timestamp) AS gap
           FROM hlstats_server_load l
           WHERE l.server_id IN (SELECT DISTINCT server_id FROM hlstats_server_load WHERE map = ?)) x
     WHERE x.map = ? AND x.max_players > 0 AND x.gap > 0`,
    [mapId, mapId],
  );
  return Number(r?.t ?? 0);
}

// Hit share of all shots on one map from the per-map player stats
// (hlstats_Players_Maps, weekly plus monthly archive); null when there are
// none (the collector does not fill these tables, imported data may).
export async function getMapAccuracy(mapId: number): Promise<number | null> {
  const src = weeksAndMonths("Players_Maps", "shots, hits", "map_id = ?", [mapId]);
  const r = await queryOne<{ shots: number | null; hits: number | null }>(`SELECT SUM(x.shots) AS shots, SUM(x.hits) AS hits FROM ${src.sql} x`, src.params);
  const shots = Number(r?.shots ?? 0);
  return shots > 0 ? Number(r?.hits ?? 0) / shots : null;
}

// GunGame wins (player action gg_win) of some players on one map, for the
// players of one table page; null when no gg_win was ever logged in the
// ranking (not a GunGame ranking: CS:S rankings all have the action), so
// the column is left out.
export async function getMapGgWins(game: string, mapId: number, playerIds: number[]): Promise<Map<number, number> | null> {
  const a = await queryOne<{ id: number }>(`SELECT id FROM hlstats_Actions WHERE game = ? AND code = 'gg_win' AND count > 0`, [game]);
  if (!a) return null;
  const out = new Map<number, number>();
  const ids = [...new Set(playerIds.filter((x) => x > 0))];
  if (!ids.length) return out;
  const rows = await query<{ playerId: number; n: number }>(
    `SELECT playerId, COUNT(*) AS n FROM hlstats_Events_PlayerActions WHERE playerId IN (?) AND map = ? AND actionId = ? GROUP BY playerId`,
    [ids, mapId, Number(a.id)],
  );
  for (const r of rows) out.set(Number(r.playerId), Number(r.n));
  return out;
}

export type TeamRow = {
  id: number;
  joined: number;
  code: string;
  name: string;
  time_played: number;
  kills: number;
  deaths: number;
  headshots: number;
  wins: number;
  losses: number;
  rounds: number;
};

// Time, kills and deaths are the collector's counters per team (kills and
// deaths without teamkills). joined counts the team changes of the game's
// players that are not hidden, grouped once instead of per team row; that
// count reads every team change of the ranking, so the rows are kept for ten
// minutes (ttl-cache.ts).
const teamsCache = ttlCache<TeamRow[]>(600_000, 86_400_000, 100);

export function getTeams(game: string): Promise<TeamRow[]> {
  return teamsCache(game, () =>
    query<TeamRow>(
      `SELECT t.teamId AS id, t.code, t.name, t.time_played, t.kills, t.deaths, t.headshots, t.wins, t.losses,
              t.rounds, COALESCE(j.joined, 0) AS joined
       FROM hlstats_Teams t
       LEFT JOIN (SELECT e.team, COUNT(*) AS joined FROM hlstats_Events_ChangeTeam e
                  JOIN hlstats_Players p ON p.playerId = e.playerId AND p.game = ? AND p.hideranking = 0
                  GROUP BY e.team) j ON j.team = t.teamId
       WHERE t.game = ? AND t.hidden = '0' ORDER BY t.time_played DESC, t.teamId`,
      [game, game],
    ),
  );
}

export function getRoles(game: string) {
  return query<TeamRow>(
    `SELECT roleId AS id, code, name, time_played, kills, deaths, headshots, wins, losses, rounds, 0 AS joined
     FROM hlstats_Roles WHERE game = ? AND hidden = '0' ORDER BY time_played DESC, roleId`,
    [game],
  );
}

// ---------------------------------------------------------------- start page: rankings

// A ranking is one hlstats_Games row: the servers with that game code share
// one player ranking (gameME calls them rankings, HLstatsX games).
export type RankingOverview = {
  code: string;
  name: string;
  realgame: string | null;
  actPlayers: number;
  maxPlayers: number;
  // Players online split into real players and bots (playerCount per server).
  online: PlayerCount;
  servers: number;
  topPlayerId: number | null;
  topPlayerName: string | null;
  topPlayerFlag: string | null;
  topPlayerCountry: string | null;
  topClanId: number | null;
  topClanTag: string | null;
};

// The best player and clan of every ranking read all players (the clans'
// average over every member of every ranking): kept for five minutes, then
// the old ones are shown while one reload runs in the background
// (ttl-cache.ts). The players online come live from the servers.
type OverviewTops = {
  tops: { game: string; playerId: number; name: string | null; flag: string | null; country: string | null }[];
  clans: { game: string; clanId: number; tag: string; skill: number }[];
};
const overviewCache = ttlCache<OverviewTops>(300_000, 86_400_000);

export async function getRankingOverview(): Promise<RankingOverview[]> {
  const [games, servers, { tops, clans }] = await Promise.all([
    getGames(),
    query<{ game: string; act: number; bots: number; max: number }>(
      `SELECT TRIM(s.game) AS game, ${capped("s.")} AS act, ${await botsOnline("s.")} AS bots, s.max_players AS max FROM hlstats_Servers s`,
    ).then((rows) => {
      const games = new Map<string, { act: number; max: number; n: number; counts: PlayerCount[] }>();
      for (const r of rows) {
        const g = games.get(r.game) ?? { act: 0, max: 0, n: 0, counts: [] };
        g.act += Number(r.act) || 0;
        g.max += Number(r.max) || 0;
        g.n += 1;
        g.counts.push(playerCount(r.act, r.bots, r.max));
        games.set(r.game, g);
      }
      return [...games].map(([game, g]) => ({ game, act: g.act, max: g.max, n: g.n, online: sumCounts(g.counts) }));
    }),
    overviewCache("tops", loadOverviewTops),
  ]);
  // A ranking without servers is only a template (e.g. the seeded css, tf).
  return games.filter((g) => servers.some((x) => x.game === g.code)).map((g) => {
    const s = servers.find((x) => x.game === g.code);
    const p = tops.find((x) => x.game === g.code);
    const c = clans.find((x) => x.game === g.code);
    return {
      code: g.code,
      name: g.name,
      realgame: g.realgame,
      actPlayers: s?.act ?? 0,
      maxPlayers: s?.max ?? 0,
      online: s?.online ?? { real: 0, bots: 0, max: 0 },
      servers: s?.n ?? 0,
      topPlayerId: p?.playerId ?? null,
      topPlayerName: p?.name ?? null,
      topPlayerFlag: p?.flag ?? null,
      topPlayerCountry: p?.country ?? null,
      topClanId: c?.clanId ?? null,
      topClanTag: c?.tag ?? null,
    };
  });
}

async function loadOverviewTops(): Promise<OverviewTops> {
  const [tops, clans] = await Promise.all([
    // Best player per ranking: highest skill, ties by lowest id.
    query<OverviewTops["tops"][number]>(
      `SELECT TRIM(p.game) AS game, p.playerId, d.lastName AS name, l.flag, l.country
       FROM hlstats_Players p
       JOIN (SELECT game, MAX(skill) AS m FROM hlstats_Players WHERE hideranking = 0 GROUP BY game) x
         ON x.game = p.game AND x.m = p.skill
       LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
       LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id
       WHERE p.hideranking = 0 ORDER BY p.playerId`,
    ),
    // Best clan per ranking: highest average skill with at least two members.
    query<OverviewTops["clans"][number]>(
      `SELECT TRIM(c.game) AS game, c.clanId, c.tag, AVG(p.skill) AS skill
       FROM hlstats_Clans c JOIN hlstats_Players p ON p.clan = c.clanId AND p.hideranking = 0
       GROUP BY c.game, c.clanId, c.tag HAVING COUNT(p.playerId) >= 2
       ORDER BY skill DESC, c.clanId`,
    ),
  ]);
  return { tops, clans };
}

export type SiteTotals = { players: number; clans: number; games: number; servers: number; kills: number; deaths: number; headshots: number };

export async function getSiteTotals(): Promise<SiteTotals> {
  const r = await queryOne<SiteTotals>(
    `SELECT (SELECT COUNT(*) FROM hlstats_Players) AS players,
            (SELECT COUNT(*) FROM hlstats_Clans) AS clans,
            (SELECT COUNT(*) FROM hlstats_Games g WHERE g.hidden = '0' AND EXISTS (SELECT 1 FROM hlstats_Servers s WHERE s.game = g.code)) AS games,
            (SELECT COUNT(*) FROM hlstats_Servers) AS servers`,
  );
  // Kills, deaths and headshots of the visible rankings.
  const k = await queryOne<{ kills: number | string | null; deaths: number | string | null; headshots: number | string | null }>(
    `SELECT SUM(p.kills) AS kills, SUM(p.deaths) AS deaths, SUM(p.headshots) AS headshots
     FROM hlstats_Players p JOIN hlstats_Games g ON g.code = p.game AND g.hidden = '0'`,
  );
  const base = r ?? { players: 0, clans: 0, games: 0, servers: 0 };
  return { ...base, kills: Number(k?.kills ?? 0), deaths: Number(k?.deaths ?? 0), headshots: Number(k?.headshots ?? 0) };
}

// Active players per day over all rankings, for the start page's load graph
// and its general statistics. Distinct players over a month of history: kept
// for five minutes, then the old days are shown while one reload runs in the
// background (ttl-cache.ts); the key holds the day so a new day is not served
// from the old one.
const dailyAllCache = ttlCache<DayPoint[]>(300_000, 86_400_000);

export function getDailyActivityAll(days: number): Promise<DayPoint[]> {
  return dailyAllCache(`${days}|${siteDay()}`, () =>
    query<DayPoint>(
      `SELECT eventTime AS day, COUNT(DISTINCT playerId) AS players, SUM(kills) AS kills, SUM(headshots) AS headshots
       FROM hlstats_Players_History WHERE ${sinceDays("eventTime")}
       GROUP BY eventTime ORDER BY eventTime`,
      [days],
    ),
  );
}

// The start page's "General statistics" over the visible rankings: all
// players (also inactive and hidden ones, bots left out) and all clans (and
// the rankings they are in; general-stats.ts), servers and those with
// real players (bots left out, playerCount), players online, all kills and
// headshots (also those of inactive players, general-stats.ts) and the time of the latest kill without
// a hidden player on either side.
export type GeneralStats = {
  players: number;
  clans: number;
  clanRankings: number;
  servers: number;
  serversActive: number;
  online: number;
  kills: number;
  headshots: number;
  lastKill: number | null;
};

// The counts over all players, clans and kills read both player tables in
// full: kept for ten minutes, then the old numbers are shown while one reload
// runs in the background (ttl-cache.ts). Players online and the latest kill
// come live.
type GeneralCounts = { players: number; clans: number; clanRankings: number; kills: number; headshots: number };
const generalCache = ttlCache<GeneralCounts>(600_000, 86_400_000);

async function loadGeneralCounts(): Promise<GeneralCounts> {
  const [p, c, sums] = await Promise.all([
    queryOne<{ n: number | string }>(allPlayersSql),
    queryOne<{ clans: number | string; rankings: number | string }>(allClansSql),
    queryOne<{ kills: number | string | null; headshots: number | string | null }>(allKillsSql),
  ]);
  return {
    players: Number(p?.n ?? 0),
    clans: Number(c?.clans ?? 0),
    clanRankings: Number(c?.rankings ?? 0),
    kills: Number(sums?.kills ?? 0),
    headshots: Number(sums?.headshots ?? 0),
  };
}

export async function getGeneralStats(): Promise<GeneralStats> {
  const [counts, s, k] = await Promise.all([
    generalCache("all", loadGeneralCounts),
    query<{ act: number; bots: number; max: number }>(
      `SELECT ${capped("s.")} AS act, ${await botsOnline("s.")} AS bots, s.max_players AS max
       FROM hlstats_Servers s JOIN hlstats_Games g ON g.code = s.game AND g.hidden = '0'`,
    ),
    // Newest first along the timestamp index; stops at the first shown kill
    // (NOT EXISTS keeps the index, an IN on the rankings sorts every frag).
    queryOne<{ t: number | string }>(
      `SELECT f.timestamp_id AS t FROM hlstats_Events_Frags f
       WHERE NOT EXISTS (SELECT 1 FROM hlstats_Games g WHERE g.id = f.game_id AND g.hidden <> '0')
         AND NOT ${hiddenSql("f.killerId")} AND NOT ${hiddenSql("f.victimId")}
       ORDER BY f.timestamp_id DESC LIMIT 1`,
    ),
  ]);
  const online = s.map((r) => playerCount(r.act, r.bots, r.max));
  return {
    ...counts,
    servers: s.length,
    serversActive: online.filter((x) => x.real > 0).length,
    online: sumCounts(online).real,
    lastKill: k ? Number(k.t) : null,
  };
}

// Clans with a visible member active that day (hlstats_Players_History; the
// member's current clan) over the visible rankings, per day. A month of
// history joined with the players: kept like getDailyActivityAll.
const clanDaysCache = ttlCache<{ day: string; n: number | string }[]>(300_000, 86_400_000);

export function getActiveClansPerDay(days: number) {
  return clanDaysCache(`${days}|${siteDay()}`, () => loadActiveClansPerDay(days));
}

function loadActiveClansPerDay(days: number) {
  return query<{ day: string; n: number | string }>(
    `SELECT h.eventTime AS day, COUNT(DISTINCT p.clan) AS n
     FROM hlstats_Players_History h
     JOIN hlstats_Players p ON p.playerId = h.playerId AND p.clan > 0 AND p.hideranking = 0
     JOIN hlstats_Games g ON g.code = h.game AND g.hidden = '0'
     WHERE ${sinceDays("h.eventTime")}
     GROUP BY h.eventTime ORDER BY h.eventTime`,
    [days],
  );
}

// ---------------------------------------------------------------- misc

export type MiscStats = {
  countries: { flag: string; country: string; n: number }[];
  connectsPerDay: { day: string; n: number }[];
  weekdays: { connects: number; seconds: number }[]; // index 0 = Monday
  connectTypes: { type: number; n: number }[];
};

// Countries of the ranked players, connects per day and per weekday.
// Countries, connect types and a year of connects and play time: counted
// over all players and events of the ranking, so kept for ten minutes, then
// the old numbers are still shown for up to a day while one reload runs in
// the background (ttl-cache.ts).
const miscCache = ttlCache<MiscStats>(600_000, 86_400_000);

export function getMiscStats(game: string, days: number): Promise<MiscStats> {
  return miscCache(`${game}|${days}|${siteDay()}`, () => loadMiscStats(game, days));
}

// The year of connects (per hour) and play time (per day) behind the Misc
// page, up to two days ago. Past hours and days do not change any more, and
// reading a year of a large ranking's events takes seconds (and on MyISAM
// holds back the collector's writes to those tables meanwhile), so this part
// is read every six hours (then reloaded in the background, ttl-cache.ts);
// each view's reload only reads the rows since `cut`.
type MiscYear = { cut: number; cutDay: string; hours: Map<number, number>; days: Map<string, number> };
const miscYearCache = ttlCache<MiscYear>(6 * 3_600_000, 86_400_000);

const MISC_CONNECTS = `SELECT FLOOR(c.timestamp_id / 3600) AS h, COUNT(*) AS n
       FROM hlstats_Events_Connects c
       WHERE c.game_id = (SELECT id FROM hlstats_Games WHERE code = ?) AND c.timestamp_id >= ?`;
const MISC_HISTORY = `SELECT eventTime AS day, SUM(connection_time) AS secs
       FROM hlstats_Players_History WHERE game = ? AND eventTime >= ?`;

function dayText(day: string | Date) {
  return typeof day === "string" ? day.slice(0, 10) : new Date(day).toISOString().slice(0, 10);
}

async function miscRows(game: string, from: number, fromDay: string, to?: { cut: number; cutDay: string }) {
  const [connects, history] = await Promise.all([
    query<{ h: number; n: number }>(
      `${MISC_CONNECTS}${to ? " AND c.timestamp_id < ?" : ""} GROUP BY FLOOR(c.timestamp_id / 3600)`,
      to ? [game, from, to.cut] : [game, from],
    ),
    query<{ day: string | Date; secs: number }>(
      `${MISC_HISTORY}${to ? " AND eventTime < ?" : ""} GROUP BY eventTime`,
      to ? [game, fromDay, to.cutDay] : [game, fromDay],
    ),
  ]);
  return {
    hours: new Map(connects.map((c) => [Number(c.h), Number(c.n)])),
    days: new Map(history.map((h) => [dayText(h.day), Number(h.secs)])),
  };
}

function loadMiscYear(game: string): Promise<MiscYear> {
  return miscYearCache(game, async () => {
    const now = Math.floor(Date.now() / 1000);
    // A day more than the page shows: the year moves on while this is kept.
    const cut = Math.floor(now / 3600) * 3600 - 2 * 86400;
    const cutDay = siteDay(-2);
    const rows = await miscRows(game, now - 366 * 86400, siteDay(-366), { cut, cutDay });
    return { cut, cutDay, ...rows };
  });
}

async function loadMiscStats(game: string, days: number): Promise<MiscStats> {
  const now = Math.floor(Date.now() / 1000);
  const yearAgo = now - 365 * 86400;
  const yearAgoDay = siteDay(-365);
  // Countries and connect methods come from the players per location
  // (playerPlaces), shared with the place selects of the player list.
  const [places, year] = await Promise.all([playerPlaces(game), loadMiscYear(game)]);
  const recent = await miscRows(game, year.cut, year.cutDay);
  // Per hour, so the hours can be put into the days of the site's time zone
  // (exact for zones with whole-hour offsets).
  const connects = [...year.hours, ...recent.hours].filter(([h]) => h * 3600 >= yearAgo);
  const history = [...year.days, ...recent.days].filter(([d]) => d >= yearAgoDay);
  // Monday = 0.
  const weekday = (day: string) => (new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7;
  const weekdays = Array.from({ length: 7 }, () => ({ connects: 0, seconds: 0 }));
  const byDay = new Map<string, number>();
  for (const [h, n] of connects) {
    const d = dayOf(h * 3600);
    byDay.set(d, (byDay.get(d) ?? 0) + n);
  }
  for (const [d, n] of byDay) weekdays[weekday(d)].connects += n;
  for (const [d, secs] of history) weekdays[weekday(d)].seconds += secs;
  const today = siteDay();
  return {
    countries: miscCountries(places),
    connectsPerDay: Array.from({ length: days }, (_, i) => {
      const day = addDays(today, i - days + 1);
      return { day, n: byDay.get(day) ?? 0 };
    }),
    weekdays,
    connectTypes: connectTypes(places),
  };
}

// The ids among `ids` of players shown in the ranking (not hidden or banned).
export async function visiblePlayerIds(ids: number[]) {
  const uniq = [...new Set(ids.filter((x) => x > 0))];
  if (!uniq.length) return new Set<number>();
  const rows = await query<{ playerId: number }>(`SELECT playerId FROM hlstats_Players WHERE playerId IN (?) AND hideranking = 0`, [uniq]);
  return new Set(rows.map((r) => Number(r.playerId)));
}

// Country flag of each player (from the latest connect's GeoIP location).
export async function getPlayerFlags(ids: number[]) {
  const uniq = [...new Set(ids.filter((x) => x > 0))];
  if (!uniq.length) return new Map<number, PlayerFlag>();
  // Bots get the code "bot": Flag shows the BOT tag in the flag's place.
  const rows = await query<{ playerId: number; game: string; flag: string | null; country: string | null; bot: number }>(
    `SELECT p.playerId, p.game, l.flag, l.country,
            CASE WHEN EXISTS (SELECT 1 FROM hlstats_PlayerUniqueIds u WHERE u.playerId = p.playerId AND u.uniqueId LIKE 'BOT%') THEN 1 ELSE 0 END AS bot
     FROM hlstats_Players p
     LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id
     WHERE p.playerId IN (?)`,
    [uniq],
  );
  const ranked = await botRankings();
  return new Map<number, PlayerFlag>(
    rows
      .filter((r) => Number(r.bot) || r.flag)
      .map((r) => [
        Number(r.playerId),
        Number(r.bot) ? { flag: "bot", country: "Bot", nolink: !ranked(String(r.game).trim()) } : { flag: r.flag as string, country: r.country ?? "" },
      ]),
  );
}

// nolink: a bot without a profile (see botProfiles), shown as plain text.
export type PlayerFlag = { flag: string; country: string; nolink?: boolean };

// The bot settings of every ranking (lib/bot-settings.ts): ranked(game)
// and points(game), true for a ranking without a stored value, and
// stats(game), false without one.
export const botRankings = cache(async () => {
  const rows = await query<{ keyname: string; value: string | null }>(
    `SELECT keyname, value FROM hlstats_Options WHERE keyname LIKE ? OR keyname LIKE ? OR keyname LIKE ?`,
    [`${RANK_BOTS_PREFIX}%`, `${BOT_POINTS_PREFIX}%`, `${BOT_STATS_PREFIX}%`],
  );
  const m = new Map(rows.map((r) => [r.keyname, r.value]));
  const ranked = (game: string) => botSettingOn(m.get(botSettingKeys(game).ranked));
  return Object.assign(ranked, {
    points: (game: string) => botSettingOn(m.get(botSettingKeys(game).points)),
    stats: (game: string) => botStatsOn(m.get(botSettingKeys(game).stats)),
  });
});

// Bots have a profile only in a ranking that ranks them
// (gamewe_rank_bots_<game>). Otherwise their names are plain text and their
// profile pages answer 404.
export const botProfiles = async (game: string) => (await botRankings())(game);

export const isBotId = (uniqueId: string | null | undefined) => (uniqueId ?? "").toUpperCase().startsWith("BOT");

// A player (getPlayer) whose public pages answer 404: a bot while bots have
// none, and a hidden player (hideranking <> 0; hidden.ts) always. Profile,
// sessions, events, awards, chat, events feed, signature, banner and avatar
// all ask this.
export async function noProfile(p: { uniqueId: string | null; game: string; hideranking?: number | null }, banned = false) {
  if (isBotId(p.uniqueId)) return !(await botProfiles(String(p.game).trim()));
  const h = Number(p.hideranking ?? 0);
  return h !== 0 && !(banned && h === 2);
}

// The bots among the ids that get no link: those of rankings that do not
// rank bots.
export async function unlinkedBots(ids: number[]) {
  const uniq = [...new Set(ids.filter((x) => x > 0))];
  if (!uniq.length) return new Set<number>();
  const rows = await query<{ playerId: number; game: string }>(
    `SELECT DISTINCT playerId, game FROM hlstats_PlayerUniqueIds WHERE playerId IN (?) AND uniqueId LIKE 'BOT%'`,
    [uniq],
  );
  const ranked = await botRankings();
  return new Set(rows.filter((r) => !ranked(String(r.game).trim())).map((r) => Number(r.playerId)));
}

// Country of each clan: the most common country among its members (ties by
// country code), from their latest connect's GeoIP location.
// With inactive, the inactive members count too (inactive clans).
export async function getClanFlags(ids: number[], inactive = false) {
  const uniq = [...new Set(ids.filter((x) => x > 0))];
  const out = new Map<number, { flag: string; country: string }>();
  if (!uniq.length) return out;
  const members = (table: string) => `SELECT playerId, clan FROM ${table} WHERE clan IN (?) AND hideranking = 0`;
  const rows = await query<{ clan: number; flag: string; country: string | null; n: number }>(
    inactive
      ? `SELECT p.clan, l.flag, MAX(l.country) AS country, COUNT(*) AS n
         FROM (${members("hlstats_Players")} UNION ALL ${members("hlstats_PlayersInactive")}) p
         JOIN hlstats_Players_Data d ON d.playerId = p.playerId
         JOIN hlstats_Players_Locations l ON l.id = d.location_id
         WHERE l.flag IS NOT NULL AND l.flag <> ''
         GROUP BY p.clan, l.flag`
      : `SELECT p.clan, l.flag, MAX(l.country) AS country, COUNT(*) AS n
         FROM hlstats_Players p
         JOIN hlstats_Players_Data d ON d.playerId = p.playerId
         JOIN hlstats_Players_Locations l ON l.id = d.location_id
         WHERE p.clan IN (?) AND p.hideranking = 0 AND l.flag IS NOT NULL AND l.flag <> ''
         GROUP BY p.clan, l.flag`,
    inactive ? [uniq, uniq] : [uniq],
  );
  const best = new Map<number, { flag: string; country: string; n: number }>();
  for (const r of rows) {
    const id = Number(r.clan);
    const n = Number(r.n);
    const b = best.get(id);
    if (!b || n > b.n || (n === b.n && r.flag < b.flag)) best.set(id, { flag: r.flag, country: r.country ?? "", n });
  }
  for (const [id, b] of best) out.set(id, { flag: b.flag, country: b.country });
  return out;
}

export type MapPlayer = {
  playerId: number;
  name: string | null;
  skill: number;
  kills: number;
  deaths: number;
  last_event: number;
  flag: string | null;
  country: string | null;
  city: string | null;
  lat: number;
  lng: number;
  // Place in the ranking, as on the ranking and the player page.
  rank?: number;
};

// Players of a ranking with a known location, most recently active first,
// for the player map. Only the GeoIP city point is used, never an address.
// place: only players of that country, state and/or city (country, state or city ranking).
// order "skill": the best players of the ranking; "recent": the most recently active.
// The map reads the players of the whole ranking with a location: kept for
// two minutes per ranking, place and order (ttl-cache.ts).
const mapPlayersCache = ttlCache<MapPlayer[]>(120_000, 600_000);

export function getMapPlayers(
  game: string,
  limit: number,
  place: { country?: string; state?: string; city?: string } = {},
  order: "skill" | "recent" = "recent",
): Promise<MapPlayer[]> {
  return mapPlayersCache(JSON.stringify([game, limit, place, order]), () => loadMapPlayers(game, limit, place, order));
}

async function loadMapPlayers(
  game: string,
  limit: number,
  place: { country?: string; state?: string; city?: string },
  order: "skill" | "recent",
): Promise<MapPlayer[]> {
  const params: Param[] = [game];
  let where = "";
  if (place.country) {
    where += " AND LOWER(l.flag) = ?";
    params.push(place.country);
  }
  if (place.state) {
    where += " AND LOWER(l.state) = ?";
    params.push(place.state.toLowerCase());
  }
  if (place.city) {
    where += " AND LOWER(l.city) = ?";
    params.push(place.city.toLowerCase());
  }
  const rows = await query<Omit<MapPlayer, "lat" | "lng"> & { lat: string; lng: string }>(
    `SELECT p.playerId, d.lastName AS name, p.skill, p.kills, p.deaths, p.last_event, l.flag, l.country, l.city, l.lat, l.lng
     FROM ${where ? placeJoins("hlstats_Players") : `hlstats_Players p
     JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     JOIN hlstats_Players_Locations l ON l.id = d.location_id`}
     WHERE p.game = ? AND p.hideranking = 0 AND l.lat <> '' AND l.lng <> ''${where}
     ORDER BY ${order === "skill" ? "p.skill DESC" : "p.last_event DESC"}, p.playerId DESC LIMIT ?`, // index game_skill / game_activity
    [...params, limit],
  );
  return withRanks(game, rows.map(mapRow).filter(onMap));
}

// All members of a clan with a known location, the active ones and those the
// collector moved to hlstats_PlayersInactive (inactive: true), for the map on
// the clan page. Only the GeoIP city point is used, never an address; hidden
// players stay out like everywhere. Only the active members have a place in
// the ranking.
export async function getClanMapPlayers(game: string, clanId: number): Promise<(MapPlayer & { inactive: boolean })[]> {
  const cols = "p.playerId, d.lastName AS name, p.skill, p.kills, p.deaths, p.last_event, l.flag, l.country, l.city, l.lat, l.lng";
  const from = `JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     JOIN hlstats_Players_Locations l ON l.id = d.location_id
     WHERE p.clan = ? AND p.hideranking = 0 AND l.lat <> '' AND l.lng <> ''`;
  const rows = await query<Omit<MapPlayer, "lat" | "lng"> & { lat: string; lng: string; active: number | string }>(
    `SELECT ${cols}, 1 AS active FROM hlstats_Players p ${from}
     UNION ALL SELECT ${cols}, 0 AS active FROM hlstats_PlayersInactive p ${from}
     ORDER BY skill DESC, playerId`,
    [clanId, clanId],
  );
  const all = rows.map((r) => ({ ...mapRow(r), inactive: Number(r.active) === 0 })).filter(onMap);
  const ranked = await withRanks(game, all.filter((r) => !r.inactive));
  return [...ranked, ...all.filter((r) => r.inactive)];
}

// Players online right now on the servers of a ranking, at the GeoIP city of
// their current connection (or their last known one), for the map on the
// servers page.
export async function getLiveMapPlayers(game: string): Promise<(MapPlayer & { server: string; serverId: number })[]> {
  const rows = await query<Omit<MapPlayer, "lat" | "lng"> & { lat: string; lng: string; server: string; serverId: number }>(
    `SELECT p.playerId, COALESCE(d.lastName, lv.name) AS name, p.skill, p.kills, p.deaths, p.last_event,
            l.flag, l.country, l.city, l.lat, l.lng, s.name AS server, s.serverId
     FROM hlstats_Livestats lv
     JOIN hlstats_Servers s ON s.serverId = lv.server_id
     JOIN hlstats_Players p ON p.playerId = lv.player_id
     LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     JOIN hlstats_Players_Locations l ON l.id = CASE WHEN lv.cli_location_id > 0 THEN lv.cli_location_id ELSE d.location_id END
     WHERE s.game = ? AND lv.player_hidden = 0 AND p.hideranking = 0 AND lv.unique_id NOT LIKE 'BOT%'
       AND l.lat <> '' AND l.lng <> ''
     ORDER BY p.skill DESC, p.playerId`,
    [game],
  );
  return withRanks(game, rows.map((r) => ({ ...mapRow(r), serverId: Number(r.serverId) })).filter(onMap));
}

// Ranking position of each map player (rankPositions: 1 + ranked players
// with more points, hidden players not counted).
async function withRanks<R extends MapPlayer>(game: string, rows: R[]): Promise<R[]> {
  const pos = await rankPositions(rows.map((r) => ({ game, skill: r.skill })));
  return rows.map((r) => ({ ...r, rank: pos.get(`${game}|${r.skill}`) }));
}

export type MapServer = {
  serverId: number;
  name: string;
  address: string;
  port: number;
  publicaddress: string;
  act_map: string;
  city: string;
  country_name: string;
  country_code: string;
  lat: number;
  lng: number;
  // Online while the collector keeps writing load samples (every 10
  // minutes), as on the server banner.
  online: boolean;
  // Game server uptime in minutes from the latest of those samples, as on
  // the server page; null when offline.
  uptime: number | null;
  // "secure" when the server is VAC-secured (Server.server_vac).
  server_vac: string;
};

// Game servers of a ranking at the GeoIP location the collector stores for
// their address (hlstats_Servers lat/lng, a city or only a country's centre).
// Servers without one (LAN address, no GeoIP database) are left out.
export async function getMapServers(game: string): Promise<MapServer[]> {
  const rows = await query<Omit<MapServer, "lat" | "lng" | "online" | "uptime"> & { lat: string; lng: string; uptime: number | null }>(
    `SELECT s.serverId, s.name, s.address, s.port, s.publicaddress, s.act_map, s.city, s.country_name, s.country_code, s.lat, s.lng,
            ${(await serverInfoOk()) ? "s.server_vac" : "'' AS server_vac"},
            (SELECT l.uptime FROM hlstats_server_load l WHERE l.server_id = s.serverId AND l.timestamp >= ?
             ORDER BY l.timestamp DESC LIMIT 1) AS uptime
     FROM hlstats_Servers s WHERE s.game = ? AND s.lat <> '' AND s.lng <> '' ORDER BY s.display_id, s.serverId`,
    [nowUnix() - 1800, game],
  );
  return rows
    .map((r) => ({ ...r, serverId: Number(r.serverId), port: Number(r.port), lat: Number(r.lat), lng: Number(r.lng), online: r.uptime !== null, uptime: r.uptime === null ? null : Number(r.uptime) }))
    .filter(onMap);
}

// The ranking's game server each of these players is on right now
// (hlstats_Livestats, as on the live map), for the lines on the top 10 map.
// Players who are not online are not in the result.
export async function getPlayerLiveServers(game: string, ids: number[]): Promise<Map<number, { serverId: number; server: string }>> {
  const out = new Map<number, { serverId: number; server: string }>();
  if (!ids.length) return out;
  const rows = await query<{ playerId: number; serverId: number; server: string }>(
    `SELECT lv.player_id AS playerId, s.serverId, s.name AS server
     FROM hlstats_Livestats lv
     JOIN hlstats_Servers s ON s.serverId = lv.server_id
     WHERE lv.player_id IN (?) AND s.game = ? AND lv.player_hidden = 0
     ORDER BY s.serverId`,
    [ids, game],
  );
  for (const r of rows) out.set(Number(r.playerId), { serverId: Number(r.serverId), server: r.server });
  return out;
}

function mapRow<R extends { playerId: number; skill: number; kills: number; deaths: number; last_event: number; lat: string; lng: string }>(r: R) {
  return { ...r, playerId: Number(r.playerId), skill: Number(r.skill), kills: Number(r.kills), deaths: Number(r.deaths), last_event: Number(r.last_event), lat: Number(r.lat), lng: Number(r.lng) };
}

function onMap(r: { lat: number; lng: number }) {
  return Number.isFinite(r.lat) && Number.isFinite(r.lng) && Math.abs(r.lat) <= 90 && Math.abs(r.lng) <= 180 && (r.lat !== 0 || r.lng !== 0);
}

// ---------------------------------------------------------------- bans page

// Players on the bans page: only ranked ones (hideranking 0). Hidden and
// banned players (hideranking 1, 2, 3) appear nowhere, here neither.
export type BanPlayer = {
  playerId: number;
  name: string | null;
  flag: string | null;
  country: string | null;
  uniqueId: string;
  skill: number;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  last_event: number;
  hideranking: number;
  // 1 when the player is in hlstats_PlayersInactive.
  inactive: number;
};

// The players the bans page may show: ranked ones and those hidden as
// banned (hideranking 2), not those hidden by an admin or by themselves;
// from hlstats_Players or from hlstats_PlayersInactive (a banned player
// stops playing, so the collector moves them out of the ranking after a
// while; the ban still runs). Two queries instead of a UNION, so that each
// uses the indexes of its table.
const playerTables = ["hlstats_Players", "hlstats_PlayersInactive"] as const;
const bannedPlayerSql = (table: (typeof playerTables)[number]) => `SELECT p.playerId, d.lastName AS name, l.flag, l.country, u.uniqueId,
    p.skill, p.kills, p.deaths, p.headshots, p.shots, p.hits, p.last_event, p.hideranking,
    ${table === "hlstats_PlayersInactive" ? 1 : 0} AS inactive
  FROM hlstats_PlayerUniqueIds u
  JOIN ${table} p ON p.playerId = u.playerId AND p.hideranking IN (0, 2)
  LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
  LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id`;

// Running bans the collector recorded (hlstats_Players_Bans,
// features.sourcebans, collector migration "player-bans"). Empty when the table does
// not exist yet; ended bans are not shown.
export type BanRecord = { playerId: number; ban_type: string; length_minutes: number; reason: string | null; banned_at: number; ends_at: number };

export async function getBanRecords(game: string): Promise<BanRecord[]> {
  try {
    return await query<BanRecord>(
      `SELECT b.player_id AS playerId, b.ban_type, b.length_minutes, b.reason, b.banned_at, b.ends_at
       FROM hlstats_Players_Bans b WHERE b.game = ? AND b.active = 1 ORDER BY b.banned_at DESC`,
      [game],
    );
  } catch {
    return [];
  }
}

// The running bans of a player recorded by the collector, newest first.
export async function getPlayerBans(playerId: number): Promise<BanRecord[]> {
  try {
    return await query<BanRecord>(
      `SELECT b.player_id AS playerId, b.ban_type, b.length_minutes, b.reason, b.banned_at, b.ends_at
       FROM hlstats_Players_Bans b WHERE b.player_id = ? AND b.active = 1 ORDER BY b.banned_at DESC LIMIT 10`,
      [playerId],
    );
  } catch {
    return [];
  }
}

// A ban of a Steam account as the collector's bans-sync job stores it
// (hlstats_Bans, collector migration "all-bans"): source steam (VAC and
// game bans from the Steam Web API, every known account) or sourcebans (a
// running ban of the SourceBans list). Per player through
// hlstats_Bans_Players, which the collector fills for every spelling of the
// Steam ID, active and inactive players of every ranking.
export type StoredBan = {
  playerId: number;
  source: string;
  banned: number;
  vac_banned: number;
  vac_bans: number;
  game_bans: number;
  days_since_last_ban: number;
  last_checked: number;
  sb_reason: string | null;
  sb_length: number;
  sb_created: number | null;
  sb_ends: number | null;
};

const storedBanCols = `bp.playerId, b.source, b.banned, b.vac_banned, b.vac_bans, b.game_bans, b.days_since_last_ban, b.last_checked,
    b.sb_reason, b.sb_length, b.sb_created, b.sb_ends`;
// Only running bans: a SourceBans ban whose end has passed counts as gone
// even before the collector deletes it (every minute).
const storedBanWhere = `b.banned = 1 AND (b.source <> 'sourcebans' OR b.sb_ends IS NULL OR b.sb_ends > ?)`;

// The running stored bans of the players of a ranking; null when the
// tables do not exist yet (a collector before "all-bans").
export async function getStoredBans(game: string, now: number): Promise<StoredBan[] | null> {
  try {
    return await query<StoredBan>(
      `SELECT ${storedBanCols} FROM hlstats_Bans_Players bp JOIN hlstats_Bans b ON b.steamid64 = bp.steamid64
       WHERE bp.game = ? AND ${storedBanWhere}`,
      [game, now],
    );
  } catch {
    return null;
  }
}

// The stored bans of one player (also the Steam row without a ban, so the
// profile knows Steam was asked); null when the tables do not exist yet.
export async function getPlayerStoredBans(playerId: number, steam64: string | null, now: number): Promise<{ bans: StoredBan[]; steamChecked: boolean } | null> {
  try {
    const [bans, checked] = await Promise.all([
      query<StoredBan>(`SELECT ${storedBanCols} FROM hlstats_Bans_Players bp JOIN hlstats_Bans b ON b.steamid64 = bp.steamid64 WHERE bp.playerId = ? AND ${storedBanWhere}`, [playerId, now]),
      steam64 ? query<{ n: number }>(`SELECT COUNT(*) AS n FROM hlstats_Bans WHERE steamid64 = ? AND source = 'steam'`, [steam64]) : Promise.resolve([]),
    ]);
    return { bans, steamChecked: Number(checked[0]?.n ?? 0) > 0 };
  } catch {
    return null;
  }
}

// The players of the given ids, as shown on the bans page (also those
// hidden as banned, also inactive ones).
export async function getBanPlayers(ids: number[]): Promise<Map<number, BanPlayer>> {
  const uniq = [...new Set(ids.filter((x) => x > 0))];
  const out = new Map<number, BanPlayer>();
  for (const table of playerTables) {
    for (let i = 0; i < uniq.length; i += 1000) {
      const rows = await query<BanPlayer>(`${bannedPlayerSql(table)} WHERE p.playerId IN (?)`, [uniq.slice(i, i + 1000)]);
      for (const r of rows) if (!out.has(Number(r.playerId))) out.set(Number(r.playerId), r);
    }
  }
  return out;
}

// ---------------------------------------------------------------- search

export type SearchIn = "names" | "uniqueid" | "clans";

export type SearchHit = {
  game: string;
  playerId: number;
  name: string | null;
  // The used name that matched, when it is not the current one.
  alias: string | null;
  flag: string | null;
  country: string | null;
  skill: number;
  kills: number;
  deaths: number;
  last_event: number;
};

export type ClanHit = { game: string; clanId: number; tag: string; name: string; members: number; skill: number | null };

const SEARCH_LIMIT = 100;

// Search across the visible rankings (game "" = all), as on gameME's search
// page: all names a player used, a Steam ID in any of its forms (exact, so
// the IDs cannot be listed by a partial search), or clan tag and name.
// Hidden and banned players are not found.
export async function searchPlayers(q: string, by: "names" | "uniqueid", game: string): Promise<SearchHit[]> {
  const where = [`p.hideranking = 0`, `g.hidden = '0'`];
  const params: Param[] = [];
  if (game) {
    where.push(`p.game = ?`);
    params.push(game);
  }
  let match: string;
  if (by === "uniqueid") {
    const ids = steamIds(q.trim());
    if (!ids) return [];
    const acc = BigInt(ids.steam64) - 76561197960265728n;
    const y = acc % 2n;
    const z = acc / 2n;
    match = `p.playerId IN (SELECT u.playerId FROM hlstats_PlayerUniqueIds u WHERE u.uniqueId IN (?))`;
    params.unshift([`${y}:${z}`, `STEAM_0:${y}:${z}`, `STEAM_1:${y}:${z}`, `[U:1:${acc}]`, `U:1:${acc}`, ids.steam64]);
    return query<SearchHit>(
      `SELECT TRIM(p.game) AS game, p.playerId, d.lastName AS name, NULL AS alias, l.flag, l.country, p.skill, p.kills, p.deaths, p.last_event
       FROM hlstats_Players p JOIN hlstats_Games g ON g.code = p.game
       LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
       LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id
       WHERE ${match} AND ${where.join(" AND ")} ORDER BY p.skill DESC LIMIT ?`,
      [...params, SEARCH_LIMIT],
    );
  }
  const rows = await query<SearchHit>(
    `SELECT TRIM(p.game) AS game, p.playerId, d.lastName AS name, MIN(n.name) AS alias, l.flag, l.country, p.skill, p.kills, p.deaths, p.last_event
     FROM hlstats_PlayerNames n
     JOIN hlstats_Players p ON p.playerId = n.playerId
     JOIN hlstats_Games g ON g.code = p.game
     LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     LEFT JOIN hlstats_Players_Locations l ON l.id = d.location_id
     WHERE n.name ${likeOp()} ? AND ${where.join(" AND ")}
     GROUP BY p.game, p.playerId, d.lastName, l.flag, l.country, p.skill, p.kills, p.deaths, p.last_event
     ORDER BY p.skill DESC LIMIT ?`,
    [like(q), ...params, SEARCH_LIMIT],
  );
  return rows.map((r) => ({ ...r, alias: r.alias && r.alias !== r.name ? r.alias : null }));
}

export function searchClans(q: string, game: string): Promise<ClanHit[]> {
  return query<ClanHit>(
    `SELECT TRIM(c.game) AS game, c.clanId, c.tag, c.name, COUNT(p.playerId) AS members, ROUND(AVG(p.skill)) AS skill
     FROM hlstats_Clans c
     JOIN hlstats_Games g ON g.code = c.game AND g.hidden = '0'
     LEFT JOIN hlstats_Players p ON p.clan = c.clanId AND p.hideranking = 0
     WHERE (c.tag ${likeOp()} ? OR c.name ${likeOp()} ?)${game ? " AND c.game = ?" : ""}
     GROUP BY c.game, c.clanId, c.tag, c.name
     HAVING COUNT(p.playerId) > 0
     ORDER BY members DESC, c.clanId LIMIT ?`,
    [like(q), like(q), ...(game ? [game] : []), SEARCH_LIMIT],
  );
}

// ---------------------------------------------------------------- help

export type HelpAction = {
  game: string;
  code: string;
  description: string | null;
  reward_player: number;
  reward_team: number;
  team: string;
  teamName: string | null;
  for_PlayerActions: string;
  for_PlayerPlayerActions: string;
  for_TeamActions: string;
  for_WorldActions: string;
};

export type HelpWeapon = { game: string; code: string; name: string; modifier: number };

// Point bonuses and weapon modifiers of the visible rankings (game "" = all)
// for the help page.
export function getHelpActions(game: string) {
  return query<HelpAction>(
    `SELECT TRIM(a.game) AS game, a.code, a.description, a.reward_player, a.reward_team, a.team, t.name AS teamName,
            a.for_PlayerActions, a.for_PlayerPlayerActions, a.for_TeamActions, a.for_WorldActions
     FROM hlstats_Actions a
     JOIN hlstats_Games g ON g.code = a.game AND g.hidden = '0'
     LEFT JOIN hlstats_Teams t ON t.game = a.game AND t.code = a.team AND a.team <> ''
     WHERE ${game ? "a.game = ?" : "1 = 1"}
     ORDER BY g.display_id, g.name, a.description, a.code`,
    game ? [game] : [],
  );
}

export function getHelpWeapons(game: string) {
  return query<HelpWeapon>(
    `SELECT TRIM(w.game) AS game, w.code, w.name, w.modifier
     FROM hlstats_Weapons w
     JOIN hlstats_Games g ON g.code = w.game AND g.hidden = '0'
     WHERE ${game ? "w.game = ?" : "1 = 1"}
     ORDER BY g.display_id, g.name, w.name, w.code`,
    game ? [game] : [],
  );
}

// The collector's point settings (defaults as in collector 1.6).
export async function getPointSettings() {
  const defs = { gamewe_start_skill: 1000, gamewe_kill_points: 5, gamewe_headshot_bonus: 0, gamewe_suicide_penalty: 5, gamewe_teamkill_penalty: 10 };
  const rows = await query<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [Object.keys(defs)]);
  const out = { ...defs };
  for (const r of rows) {
    const n = Number.parseInt(r.value, 10);
    if (r.keyname in out && Number.isFinite(n) && n >= 0) out[r.keyname as keyof typeof defs] = n;
  }
  return out;
}

// Best players of a ranking for the sitemap (visible ones only).
export function getSitemapPlayers(game: string, limit: number) {
  return query<{ playerId: number; last_event: number }>(
    `SELECT playerId, last_event FROM hlstats_Players WHERE game = ? AND hideranking = 0 ORDER BY skill DESC, playerId DESC LIMIT ?`,
    [game, limit],
  );
}
