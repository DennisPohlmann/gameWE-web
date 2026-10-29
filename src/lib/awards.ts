import "server-only";
import { hiddenSql } from "./hidden";
import { careerKills, getPlayerFlags } from "./data";
import { dayRange, siteDay } from "./day";
import { query } from "./db";
import type { Rank } from "./career";
import { PLAYER_AWARDS } from "./player-awards";
import { rankPlayerSorts, type RankPlayerSort } from "./table-sort";

// Daily awards, ribbons and ranks, as on gameME.
//
// hlstats_Awards defines the awards of a game: W = most kills with the weapon
// `code`, O = most of the action `code`, and a few player awards (type O or P
// with the codes in PLAYER_AWARDS, of any type) taken from the day's hlstats_Players_History.
// The collector stores each day's winner in hlstats_Awards_History; the web
// computes the running day itself (and the previous day while nothing is
// stored yet). Winning an award again and again earns a ribbon of that award,
// whose class (bronze, silver, gold) comes from hlstats_Definition_Ribbons_Classes.
// "latency" (type W, but not a weapon) goes to the lowest average ping of the
// day in hlstats_Events_Latency, by the collector's rule (LATENCY_MIN_SAMPLES).
// Ranks are kill thresholds in hlstats_Definition_Ranks_Ribbons.

// The award queries scan the day's events, which is slow on big tables, so
// their results are kept for a short while: today's leaders 2 minutes,
// everything else 10 minutes.
const TODAY_TTL = 120_000;
const TTL = 600_000;
const cache = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>();

function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>;
  if (cache.size > 500) cache.clear();
  const value = load();
  cache.set(key, { at: Date.now(), ttl, value });
  // A failed query is not kept.
  value.catch(() => cache.delete(key));
  return value;
}

export { PLAYER_AWARDS };

// Ping samples (one per minute online, 0 left out) a player needs on a day
// for the latency award, as LatencyMinSamples in the collector.
export const LATENCY_MIN_SAMPLES = 30;

export type Award = { awardId: number; awardType: string; code: string; name: string; verb: string };
export type AwardWin = { awardId: number; playerId: number; name: string | null; value: number };

export function getAwards(game: string) {
  return query<Award>(
    `SELECT awardId, awardType, code, name, verb FROM hlstats_Awards WHERE game = ? ORDER BY name, awardId`,
    [game],
  );
}

type Row = { code: string; playerId: number; name: string | null; value: number };

// Best player per award code; rows come ordered by code, value desc, playerId.
function best(rows: Row[], awards: Award[], kind: (a: Award) => boolean): AwardWin[] {
  const byCode = new Map<string, Row>();
  for (const r of rows) if (!byCode.has(r.code)) byCode.set(r.code, r);
  return awards.filter(kind).flatMap((a) => {
    const r = byCode.get(a.code);
    return r && r.value > 0 ? [{ awardId: a.awardId, playerId: r.playerId, name: r.name, value: r.value }] : [];
  });
}

// The winners of one day (in the site's time zone), computed from the events of that day.
export function computeDay(game: string, day: string, awards: Award[]): Promise<Map<number, AwardWin>> {
  return cached(`day:${game}:${day}`, day === siteDay() ? TODAY_TTL : TTL, () => computeDayNow(game, day, awards));
}

async function computeDayNow(game: string, day: string, awards: Award[]): Promise<Map<number, AwardWin>> {
  const [start, end] = dayRange(day);
  const isPlayer = (a: Award) => a.code in PLAYER_AWARDS;
  const isLatency = (a: Award) => a.awardType === "W" && a.code === "latency";
  const isWeapon = (a: Award) => a.awardType === "W" && !isPlayer(a) && !isLatency(a);
  const weapons = awards.filter(isWeapon).map((a) => a.code);
  const actions = awards.filter((a) => a.awardType !== "W" && !isPlayer(a)).map((a) => a.code);
  const players = awards.filter(isPlayer);

  const [w, o, p, l] = await Promise.all([
    weapons.length
      ? query<Row>(
          `SELECT wp.code, f.killerId AS playerId, d.lastName AS name, COUNT(*) AS value
           FROM hlstats_Events_Frags f
           JOIN hlstats_Weapons wp ON wp.weaponId = f.weapon
           JOIN hlstats_Players p ON p.playerId = f.killerId AND p.hideranking = 0
           LEFT JOIN hlstats_Players_Data d ON d.playerId = f.killerId
           WHERE f.timestamp_id >= ? AND f.timestamp_id < ? AND wp.game = ? AND wp.code IN (?)
           GROUP BY wp.code, f.killerId, d.lastName
           ORDER BY wp.code, COUNT(*) DESC, f.killerId`,
          [start, end, game, weapons],
        )
      : [],
    actions.length
      ? // Counted per action and player first, then joined: the day's events
        // are many, the players few. (game, code) is unique in hlstats_Actions.
        query<Row>(
          `SELECT ac.code, x.playerId, d.lastName AS name, x.value
           FROM (SELECT e.actionId, e.playerId, COUNT(*) AS value
                 FROM hlstats_Events_PlayerActions e
                 WHERE e.timestamp_id >= ? AND e.timestamp_id < ?
                   AND e.actionId IN (SELECT id FROM hlstats_Actions WHERE game = ? AND code IN (?))
                 GROUP BY e.actionId, e.playerId) x
           JOIN hlstats_Actions ac ON ac.id = x.actionId
           JOIN hlstats_Players p ON p.playerId = x.playerId AND p.hideranking = 0
           LEFT JOIN hlstats_Players_Data d ON d.playerId = x.playerId
           ORDER BY ac.code, x.value DESC, x.playerId`,
          [start, end, game, actions],
        )
      : [],
    Promise.all(
      players.map((a) =>
        query<Row>(
          `SELECT ? AS code, h.playerId, d.lastName AS name, h.${PLAYER_AWARDS[a.code]} AS value
           FROM hlstats_Players_History h
           JOIN hlstats_Players p ON p.playerId = h.playerId AND p.hideranking = 0
           LEFT JOIN hlstats_Players_Data d ON d.playerId = h.playerId
           WHERE h.eventTime = ? AND h.game = ?
           ORDER BY h.${PLAYER_AWARDS[a.code]} DESC, h.playerId LIMIT 1`,
          [a.code, day, game],
        ),
      ),
    ).then((r) => r.flat()),
    // Lowest average ping wins; the value is the rounded average in ms.
    // Averaged per player first, then joined (one sample per player and minute).
    awards.some(isLatency)
      ? query<Row>(
          `SELECT 'latency' AS code, x.playerId, d.lastName AS name, ROUND(x.ping) AS value
           FROM (SELECT e.playerId, AVG(e.ping) AS ping
                 FROM hlstats_Events_Latency e
                 WHERE e.timestamp_id >= ? AND e.timestamp_id < ? AND e.ping > 0
                 GROUP BY e.playerId
                 HAVING COUNT(*) >= ?) x
           JOIN hlstats_Players p ON p.playerId = x.playerId AND p.hideranking = 0 AND p.game = ?
           LEFT JOIN hlstats_Players_Data d ON d.playerId = x.playerId
           ORDER BY x.ping, x.playerId LIMIT 1`,
          [start, end, LATENCY_MIN_SAMPLES, game],
        ).then((r) => r.map((x) => ({ ...x, value: Math.max(1, Number(x.value)) })))
      : [],
  ]);

  const wins = [
    ...best(w, awards, isWeapon),
    ...best(o, awards, (a) => a.awardType !== "W" && !isPlayer(a)),
    ...best(p, awards, isPlayer),
    ...best(l, awards, isLatency),
  ];
  return new Map(wins.map((x) => [x.awardId, x]));
}

// Winners stored by the collector for one day.
export function storedDay(game: string, day: string): Promise<Map<number, AwardWin>> {
  return cached(`stored:${game}:${day}`, TTL, () => storedDayNow(game, day));
}

async function storedDayNow(game: string, day: string): Promise<Map<number, AwardWin>> {
  const rows = await query<AwardWin>(
    `SELECT h.award_id AS awardId, h.winner_id AS playerId, d.lastName AS name, h.winner_count AS value
     FROM hlstats_Awards_History h
     JOIN hlstats_Awards a ON a.awardId = h.award_id
     LEFT JOIN hlstats_Players_Data d ON d.playerId = h.winner_id
     WHERE a.game = ? AND h.date = ? AND NOT ${hiddenSql("h.winner_id")}`,
    [game, day],
  );
  return new Map(rows.map((r) => [r.awardId, r]));
}

export type AwardBoardRow = Award & { winner?: AwardWin; leader?: AwardWin };

// One past day's winners (stored, else computed from the events of that day).
export async function getAwardDay(game: string, day: string) {
  const awards = await getAwards(game);
  const winners = day === siteDay() ? await computeDay(game, day, awards) : await storedOrComputed(game, day, awards);
  const flags = await getPlayerFlags([...winners.values()].map((w) => w.playerId));
  return { day, flags, rows: awards.map((a): AwardBoardRow => ({ ...a, winner: winners.get(a.awardId) })) };
}

async function storedOrComputed(game: string, day: string, awards: Award[]) {
  const stored = await storedDay(game, day);
  return stored.size ? stored : computeDay(game, day, awards);
}

// Days of a month (YYYY-MM) with stored winners, for the calendar.
export async function getAwardDays(game: string, month: string): Promise<Set<string>> {
  const rows = await query<{ date: string }>(
    `SELECT DISTINCT h.date FROM hlstats_Awards_History h JOIN hlstats_Awards a ON a.awardId = h.award_id
     WHERE a.game = ? AND h.date >= ? AND h.date <= ?`,
    [game, `${month}-01`, `${month}-31`],
  );
  return new Set(rows.map((r) => String(r.date).slice(0, 10)));
}

// Latest day (YYYY-MM-DD) with stored winners, in the collector's zone like
// the stored days; null when nothing is stored yet.
export async function getLastAwardDay(game: string): Promise<string | null> {
  const rows = await query<{ date: string | null }>(
    `SELECT MAX(h.date) AS date FROM hlstats_Awards_History h JOIN hlstats_Awards a ON a.awardId = h.award_id WHERE a.game = ?`,
    [game],
  );
  const d = rows[0]?.date;
  return d ? String(d).slice(0, 10) : null;
}

// Players with the most award wins (gameME's "Most Decorated Players").
export function getMostDecorated(game: string, limit: number) {
  return cached(`decorated:${game}:${limit}`, TTL, () => mostDecorated(game, limit));
}

async function mostDecorated(game: string, limit: number) {
  const c = await careerKills();
  return query<{ playerId: number; name: string | null; kills: number; wins: number }>(
    `SELECT h.winner_id AS playerId, d.lastName AS name, ${c} AS kills, COUNT(*) AS wins
     FROM hlstats_Awards_History h
     JOIN hlstats_Awards a ON a.awardId = h.award_id
     JOIN hlstats_Players p ON p.playerId = h.winner_id AND p.hideranking = 0
     LEFT JOIN hlstats_Players_Data d ON d.playerId = h.winner_id
     WHERE a.game = ?
     GROUP BY h.winner_id, d.lastName, ${c}
     ORDER BY COUNT(*) DESC, h.winner_id LIMIT ?`,
    [game, limit],
  );
}

// Yesterday's winners (stored, else computed) and today's leaders.
export async function getAwardBoard(game: string) {
  const awards = await getAwards(game);
  const yesterday = siteDay(-1);
  const [stored, today] = await Promise.all([storedDay(game, yesterday), computeDay(game, siteDay(), awards)]);
  const winners = stored.size ? stored : await computeDay(game, yesterday, awards);
  const flags = await getPlayerFlags([...winners.values(), ...today.values()].map((w) => w.playerId));
  return {
    day: yesterday,
    flags,
    rows: awards.map((a): AwardBoardRow => ({ ...a, winner: winners.get(a.awardId), leader: today.get(a.awardId) })),
  };
}

// How a value of an award reads: "12 kills with awp", "03:12h".
export function awardValue(a: Pick<Award, "code" | "verb">, value: number, fmt: (n: number) => string, duration: (s: number) => string) {
  if (a.code === "longest_playtime") return duration(value);
  return `${fmt(value)} ${a.verb}`;
}

// ---------------------------------------------------------------- ribbons

export type RibbonClass = { name: string; maximum: number; steps: number; class: number };

export async function getRibbonClasses(game: string): Promise<RibbonClass[]> {
  const rows = await query<RibbonClass>(
    `SELECT name, maximum, steps, class FROM hlstats_Definition_Ribbons_Classes WHERE game_code = ? ORDER BY class`,
    [game],
  );
  return rows.length
    ? rows
    : [
        { name: "{LANG_BRONZE}", maximum: 8, steps: 1, class: 1 },
        { name: "{LANG_SILVER}", maximum: 8, steps: 1, class: 2 },
        { name: "{LANG_GOLD}", maximum: 8, steps: 1, class: 3 },
      ];
}

// Ribbon for `wins` wins: class 1 for the first `maximum` wins, then class 2
// and so on; the last class keeps counting up to its maximum.
export function ribbonFor(wins: number, classes: RibbonClass[]) {
  if (wins <= 0 || !classes.length) return null;
  let left = wins;
  for (let i = 0; i < classes.length; i++) {
    const c = classes[i];
    const per = Math.max(1, c.maximum) * Math.max(1, c.steps);
    if (left <= per || i === classes.length - 1) {
      return { index: i, name: c.name, level: Math.min(Math.ceil(left / Math.max(1, c.steps)), Math.max(1, c.maximum)), max: Math.max(1, c.maximum) };
    }
    left -= per;
  }
  return null;
}

// Where `wins` wins stand: class and level, the share of the class done and
// how many more wins the next class needs (null in the last class).
export function ribbonProgress(wins: number, classes: RibbonClass[]) {
  const r = ribbonFor(wins, classes);
  if (!r) return null;
  const per = (c: RibbonClass) => Math.max(1, c.maximum) * Math.max(1, c.steps);
  const before = classes.slice(0, r.index).reduce((n, c) => n + per(c), 0);
  const into = wins - before;
  const size = per(classes[r.index]);
  const next = classes[r.index + 1];
  return { ...r, share: Math.min(1, into / size), nextName: next?.name ?? null, toNext: next ? Math.max(1, size - into + 1) : null };
}

export type RibbonRow = { awardId: number; code: string; name: string; verb: string; wins: number };

export function getPlayerRibbons(playerId: number) {
  return query<RibbonRow>(
    `SELECT a.awardId, a.code, a.name, a.verb, COUNT(*) AS wins
     FROM hlstats_Awards_History h JOIN hlstats_Awards a ON a.awardId = h.award_id
     WHERE h.winner_id = ?
     GROUP BY a.awardId, a.code, a.name, a.verb
     ORDER BY COUNT(*) DESC, a.name`,
    [playerId],
  );
}

export type RibbonLeader = { awardId: number; playerId: number; name: string | null; wins: number };

// Per award the player with the most wins (ties: the lowest id), how many
// players have won it at all and each holder's number of wins.
export function getRibbonLeaders(game: string) {
  return cached(`leaders:${game}`, TTL, () => ribbonLeaders(game));
}

async function ribbonLeaders(game: string) {
  const rows = await query<RibbonLeader>(
    `SELECT h.award_id AS awardId, h.winner_id AS playerId, d.lastName AS name, COUNT(*) AS wins
     FROM hlstats_Awards_History h
     JOIN hlstats_Awards a ON a.awardId = h.award_id
     JOIN hlstats_Players p ON p.playerId = h.winner_id AND p.hideranking = 0
     LEFT JOIN hlstats_Players_Data d ON d.playerId = h.winner_id
     WHERE a.game = ?
     GROUP BY h.award_id, h.winner_id, d.lastName
     ORDER BY h.award_id, COUNT(*) DESC, h.winner_id`,
    [game],
  );
  const top = new Map<number, RibbonLeader & { holders: number; all: number[] }>();
  for (const r of rows) {
    const t = top.get(r.awardId);
    if (t) {
      t.holders++;
      t.all.push(Number(r.wins));
    } else top.set(r.awardId, { ...r, holders: 1, all: [Number(r.wins)] });
  }
  return top;
}

export type RibbonHolder = { playerId: number; name: string | null; wins: number; last: string };

export function getRibbonHolders(awardId: number, limit: number) {
  return query<RibbonHolder>(
    `SELECT h.winner_id AS playerId, d.lastName AS name, COUNT(*) AS wins, MAX(h.date) AS last
     FROM hlstats_Awards_History h
     JOIN hlstats_Players p ON p.playerId = h.winner_id AND p.hideranking = 0
     LEFT JOIN hlstats_Players_Data d ON d.playerId = h.winner_id
     WHERE h.award_id = ?
     GROUP BY h.winner_id, d.lastName
     ORDER BY COUNT(*) DESC, MAX(h.date) DESC, h.winner_id LIMIT ?`,
    [awardId, limit],
  );
}

// ---------------------------------------------------------------- ranks

export { rankFor, rankStep, type Rank } from "./career";

export async function getRanks(game: string): Promise<Rank[]> {
  const rows = await query<{ name: string; minimum: number }>(
    `SELECT name, minimum FROM hlstats_Definition_Ranks_Ribbons
     WHERE game_code = ? AND definition_type IN ('ranks', 'rank') AND restriction_type = 'kills'
     ORDER BY minimum, id`,
    [game],
  );
  return rows.map((r, i) => ({ index: i, name: r.name, minimum: r.minimum ?? 0, next: rows[i + 1]?.minimum ?? null }));
}

// Number of ranked players in each rank, in one pass.
export function getRankCounts(game: string, ranks: Rank[]): Promise<number[]> {
  if (!ranks.length) return Promise.resolve([]);
  return cached(`rankcounts:${game}:${ranks.map((r) => r.minimum).join(",")}`, TTL, () => rankCounts(game, ranks));
}

async function rankCounts(game: string, ranks: Rank[]): Promise<number[]> {
  const c = await careerKills("");
  const cols = ranks.map(
    (r, i) => `COALESCE(SUM(CASE WHEN ${c} >= ${Number(r.minimum)}${r.next !== null ? ` AND ${c} < ${Number(r.next)}` : ""} THEN 1 ELSE 0 END), 0) AS r${i}`,
  );
  const row = (await query<Record<string, number>>(
    `SELECT ${cols.join(", ")} FROM hlstats_Players WHERE game = ? AND hideranking = 0`,
    [game],
  ))[0];
  return ranks.map((_, i) => Number(row?.[`r${i}`] ?? 0));
}

export type RankPlayer = { playerId: number; name: string | null; skill: number; kills: number; connection_time: number; last_event: number };

// kills are the kills of the career rank (careerKills).
export async function getRankPlayers(game: string, rank: Rank, limit: number, offset: number, sort: RankPlayerSort = "kills", asc = false) {
  const c = await careerKills();
  const upper = rank.next !== null ? `AND ${c} < ?` : "";
  // The column comes from the allowlist, never from the URL itself.
  const order = `${sort === "kills" ? c : rankPlayerSorts[sort]} ${asc ? "ASC" : "DESC"}, p.playerId`;
  return query<RankPlayer>(
    `SELECT p.playerId, d.lastName AS name, p.skill, ${c} AS kills, p.connection_time, p.last_event
     FROM hlstats_Players p LEFT JOIN hlstats_Players_Data d ON d.playerId = p.playerId
     WHERE p.game = ? AND p.hideranking = 0 AND ${c} >= ? ${upper}
     ORDER BY ${order} LIMIT ? OFFSET ?`,
    [game, rank.minimum, ...(rank.next !== null ? [rank.next] : []), limit, offset],
  );
}

// How many of `wins` (one entry per holder) reached ribbon class `index`.
export function reachedClass(wins: number[], index: number, classes: RibbonClass[]): number {
  return wins.filter((w) => (ribbonFor(w, classes)?.index ?? -1) >= index).length;
}

// Number of ranked players of a game, the base of the percentages.
export async function getRankedCount(game: string): Promise<number> {
  const [row] = await query<{ n: number }>(`SELECT COUNT(*) AS n FROM hlstats_Players WHERE game = ? AND hideranking = 0`, [game]);
  return Number(row?.n ?? 0);
}
