import "server-only";
import { steamIds } from "./format";
import { getSteamProfile } from "./steam";
import { hiddenSql } from "./hidden";
import { query } from "./db";
import { lastStart, nextStart, podium, type HallPeriod, type HallUnit } from "./hall-period";
import { effectiveSchedule, nextResetKey, parseNext } from "./job-plan";

export { periodLabel, type HallPeriod } from "./hall-period";

// Hall of fame of a ranking. When the collector resets a ranking on its
// schedule (every N days, weeks, months or years), it first copies the best
// players of the ending period into hlstats_gamewe_hall_of_fame: one row per
// place, with the values of that moment (name, country and stats), so an
// entry stays as it was even after the player is renamed or deleted.
// Collector 0.19 stored three places, newer ones five.
//
// The podium shows the first three entries an admin did not remove
// (column removed, collector migration 16) whose player is not hidden now
// (as on all public pages): the ones below move up, so with five stored a
// removed or hidden player is replaced by the fourth. With fewer entries
// the places stay empty.

export type HallEntry = {
  place: number; // on the podium (after moving up)
  stored: number; // the place the collector stored
  playerId: number;
  name: string; // as stored at the end of the period
  currentName: string | null; // the player's name now (hlstats_Players_Data), null when deleted
  uniqueId: string | null;
  flag: string;
  country: string;
  skill: number;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  killStreak: number;
  connectionTime: number;
  favWeapon: string;
  favWeaponName: string | null;
  rankName: string;
};

export type HallRow = HallPeriod & {
  resetAt: number;
  players: number;
  places: (HallEntry | null)[];
};

export type StarCount = { gold: number; silver: number; bronze: number };
export type StarHolder = StarCount & { playerId: number; name: string; flag: string; country: string; last: string };

type Raw = {
  unit: string;
  every: number;
  period_start: string | Date;
  period_end: string | Date;
  reset_at: number;
  players: number;
  place: number;
  player_id: number;
  name: string;
  flag: string;
  country: string;
  skill: number;
  kills: number;
  deaths: number;
  headshots: number;
  shots: number;
  hits: number;
  kill_streak: number;
  connection_time: number;
  fav_weapon: string;
  rank_name: string | null;
  weapon_name: string | null;
  hidden: number;
  removed: number;
  current_name: string | null;
  unique_id: string | null;
};

// Collector migration 16 adds the column removed; before it nothing is
// removed. Checked again every 5 minutes.
let removedColumn: { at: number; has: boolean } | null = null;

export async function hasRemovedColumn(): Promise<boolean> {
  if (removedColumn && Date.now() - removedColumn.at < 300_000) return removedColumn.has;
  let has = true;
  try {
    await query(`SELECT removed FROM hlstats_gamewe_hall_of_fame WHERE 1 = 0`);
  } catch {
    has = false;
  }
  removedColumn = { at: Date.now(), has };
  return has;
}


// Dates come back as Date (Postgres) or string (MariaDB); both as YYYY-MM-DD.
function day(v: string | Date): string {
  return v instanceof Date ? `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}` : String(v).slice(0, 10);
}

function unit(v: string): HallUnit {
  return v === "day" || v === "week" || v === "year" ? v : "month";
}

function every(v: number): number {
  const n = Math.trunc(Number(v));
  return n >= 1 ? n : 1;
}

// All periods of a ranking, newest first, each with its three places.
export async function getHallOfFame(game: string): Promise<HallRow[]> {
  const removed = (await hasRemovedColumn()) ? "h.removed" : "0";
  const rows = await query<Raw>(
    `SELECT h.unit, h.every, h.period_start, h.period_end, h.reset_at, h.players, h.place, h.player_id, h.name, h.flag, h.country,
            h.skill, h.kills, h.deaths, h.headshots, h.shots, h.hits, h.kill_streak, h.connection_time, h.fav_weapon, h.rank_name,
            w.name AS weapon_name, d.lastName AS current_name,
            (SELECT MIN(u.uniqueId) FROM hlstats_PlayerUniqueIds u WHERE u.playerId = h.player_id) AS unique_id,
            CASE WHEN ${hiddenSql("h.player_id")} THEN 1 ELSE 0 END AS hidden, ${removed} AS removed
     FROM hlstats_gamewe_hall_of_fame h
     LEFT JOIN hlstats_Weapons w ON w.game = h.game AND w.code = h.fav_weapon
     LEFT JOIN hlstats_Players_Data d ON d.playerId = h.player_id
     WHERE h.game = ?
     ORDER BY h.period_start DESC, h.place`,
    [game],
  );
  const out: HallRow[] = [];
  const entries: (HallEntry & { removed: boolean; hidden: boolean })[][] = [];
  for (const r of rows) {
    const start = day(r.period_start);
    let row = out.at(-1);
    if (!row || row.start !== start) {
      row = { unit: unit(r.unit), every: every(r.every), start, end: day(r.period_end), resetAt: Number(r.reset_at), players: Number(r.players), places: [null, null, null] };
      out.push(row);
      entries.push([]);
    }
    entries.at(-1)!.push({
      place: 0,
      stored: Number(r.place),
      playerId: Number(r.player_id),
      name: r.name,
      currentName: r.current_name,
      uniqueId: r.unique_id,
      flag: r.flag,
      country: r.country,
      skill: Number(r.skill),
      kills: Number(r.kills),
      deaths: Number(r.deaths),
      headshots: Number(r.headshots),
      shots: Number(r.shots),
      hits: Number(r.hits),
      killStreak: Number(r.kill_streak),
      connectionTime: Number(r.connection_time),
      favWeapon: r.fav_weapon,
      favWeaponName: r.weapon_name,
      rankName: r.rank_name ?? "",
      removed: Number(r.removed) !== 0,
      hidden: Number(r.hidden) !== 0,
    });
  }
  out.forEach((row, i) => {
    for (const e of podium(entries[i])) {
      const { removed: _r, hidden: _h, ...entry } = e;
      row.places[e.place - 1] = entry;
    }
  });
  // A period whose entries were all removed is left out.
  return out.filter((row, i) => entries[i].some((e) => !e.removed));
}

// Stars per player from the periods above: gold for place 1, silver for 2,
// bronze for 3; most gold first, then silver, then bronze, then the latest.
// The name shown is the one of the player's latest entry.
export function starTable(rows: HallRow[]): StarHolder[] {
  const by = new Map<number, StarHolder>();
  for (const row of rows) {
    for (const e of row.places) {
      if (!e || e.playerId <= 0) continue;
      const h = by.get(e.playerId) ?? { playerId: e.playerId, name: e.currentName ?? e.name, flag: e.flag, country: e.country, last: row.start, gold: 0, silver: 0, bronze: 0 };
      if (e.place === 1) h.gold++;
      else if (e.place === 2) h.silver++;
      else h.bronze++;
      by.set(e.playerId, h);
    }
  }
  return [...by.values()].sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || b.last.localeCompare(a.last) || a.name.localeCompare(b.name));
}

// The players' Steam profiles now (name and avatar) for the cards of the
// shown periods, by player id. Players without a Steam ID (bots, deleted
// players) and lookups slower than three seconds are left out; the card then
// shows the name from the database.
export type HallSteam = { name: string | null; avatar: string | null };

export async function hallSteam(rows: HallRow[]): Promise<Map<number, HallSteam>> {
  const ids = new Map<number, string>();
  for (const row of rows) {
    for (const e of row.places) {
      const s = e?.currentName !== null && e?.uniqueId ? steamIds(e.uniqueId) : null;
      if (e && s) ids.set(e.playerId, s.steam64);
    }
  }
  const out = new Map<number, HallSteam>();
  const slow = new Promise<null>((r) => setTimeout(() => r(null), 3000));
  await Promise.all(
    [...ids].map(async ([id, steam64]) => {
      const p = await Promise.race([getSteamProfile(steam64).catch(() => null), slow]);
      if (p && (p.name || p.avatar)) out.set(id, { name: p.name, avatar: p.avatar });
    }),
  );
  return out;
}

// Stars of one player in a ranking (profile page), counted like the star
// table (after moving up).
export async function getPlayerStars(game: string, playerId: number): Promise<StarCount> {
  const s = starTable(await getHallOfFame(game)).find((h) => h.playerId === playerId);
  return { gold: s?.gold ?? 0, silver: s?.silver ?? 0, bronze: s?.bronze ?? 0 };
}

// Whether the ranking shows the hall of fame (tab, page, stars in profiles).
// Admin > Rankings sets it per ranking (hlstats_Options gamewe_hof_<game>:
// "1" always, "0" never). Unset (automatic) only while the ranking has
// entries an admin did not remove: the tab appears with the first reset and
// goes again when the entries are deleted. Never without the table (a
// collector before the hall of fame). Every page of a ranking asks (the
// tab), so the answer is kept for 30 seconds.
const shownCache = new Map<string, { at: number; value: boolean }>();

export async function hallOfFameShown(game: string): Promise<boolean> {
  const hit = shownCache.get(game);
  if (hit && Date.now() - hit.at < 30_000) return hit.value;
  let value = false;
  try {
    const rows = await query<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [`gamewe_hof_${game}`]);
    const removed = (await hasRemovedColumn()) ? " AND removed = 0" : "";
    const entries = (await query(`SELECT 1 AS x FROM hlstats_gamewe_hall_of_fame WHERE game = ?${removed} LIMIT 1`, [game])).length > 0;
    const set = (rows[0]?.value ?? "").trim();
    value = set === "1" || (set !== "0" && entries);
  } catch {
    value = false;
  }
  shownCache.set(game, { at: Date.now(), value });
  return value;
}

// When the running period of the ranking's scheduled reset ends (the next
// entries of the hall of fame), for the note at the end of its page: the
// time the collector wrote (gamewe_next_reset_<game>, collector 0.27.0),
// else the day from the start of the period (gamewe_reset_last_<game>) and
// the schedule. null without a schedule (own "off", or none for all
// rankings), for a template (no servers, never reset) and before the
// collector started the period.
export type NextHallReset = { at: number } | { day: string } | null;

export async function nextHallReset(game: string): Promise<NextHallReset> {
  try {
    const keys = [`gamewe_reset_schedule_${game}`, "gamewe_reset_schedule", nextResetKey(game), `gamewe_reset_last_${game}`];
    const [rows, servers] = await Promise.all([
      query<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [keys]),
      query<{ n: number | string }>(`SELECT COUNT(*) AS n FROM hlstats_Servers WHERE game = ?`, [game]),
    ]);
    if (!Number(servers[0]?.n ?? 0)) return null;
    const o = new Map(rows.map((r) => [r.keyname, (r.value ?? "").trim()]));
    const schedule = effectiveSchedule(o.get(keys[0]), o.get(keys[1]));
    if (!schedule) return null;
    const at = parseNext(o.get(keys[2]));
    if (at) return { at };
    const last = lastStart(o.get(keys[3]));
    return last ? { day: nextStart(last, schedule) } : null;
  } catch {
    return null;
  }
}

export function invalidateHallOfFame() {
  shownCache.clear();
}
