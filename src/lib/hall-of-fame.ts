import "server-only";
import { hiddenSql } from "./hidden";
import { query } from "./db";
import { parseSchedule, type HallPeriod, type HallUnit } from "./hall-period";

export { periodLabel, type HallPeriod } from "./hall-period";

// Hall of fame of a ranking. When the collector resets a ranking on its
// schedule (every N days, weeks, months or years), it first copies the best three
// players of the ending period into hlstats_gamewe_hall_of_fame: one row per
// place, with the values of that moment (name, country and stats), so an
// entry stays as it was even after the player is renamed or deleted. Rows
// are never changed afterwards.
//
// A player who is hidden now is left out of every list (place shown empty),
// as on all public pages.

export type HallEntry = {
  place: number;
  playerId: number;
  name: string;
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
};

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
  const rows = await query<Raw>(
    `SELECT h.unit, h.every, h.period_start, h.period_end, h.reset_at, h.players, h.place, h.player_id, h.name, h.flag, h.country,
            h.skill, h.kills, h.deaths, h.headshots, h.shots, h.hits, h.kill_streak, h.connection_time, h.fav_weapon, h.rank_name,
            w.name AS weapon_name,
            CASE WHEN ${hiddenSql("h.player_id")} THEN 1 ELSE 0 END AS hidden
     FROM hlstats_gamewe_hall_of_fame h
     LEFT JOIN hlstats_Weapons w ON w.game = h.game AND w.code = h.fav_weapon
     WHERE h.game = ?
     ORDER BY h.period_start DESC, h.place`,
    [game],
  );
  const out: HallRow[] = [];
  for (const r of rows) {
    const start = day(r.period_start);
    let row = out.at(-1);
    if (!row || row.start !== start) {
      row = { unit: unit(r.unit), every: every(r.every), start, end: day(r.period_end), resetAt: Number(r.reset_at), players: Number(r.players), places: [null, null, null] };
      out.push(row);
    }
    const place = Number(r.place);
    if (place < 1 || place > 3 || Number(r.hidden)) continue;
    row.places[place - 1] = {
      place,
      playerId: Number(r.player_id),
      name: r.name,
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
    };
  }
  return out;
}

// Stars per player from the periods above: gold for place 1, silver for 2,
// bronze for 3; most gold first, then silver, then bronze, then the latest.
// The name shown is the one of the player's latest entry.
export function starTable(rows: HallRow[]): StarHolder[] {
  const by = new Map<number, StarHolder>();
  for (const row of rows) {
    for (const e of row.places) {
      if (!e || e.playerId <= 0) continue;
      const h = by.get(e.playerId) ?? { playerId: e.playerId, name: e.name, flag: e.flag, country: e.country, last: row.start, gold: 0, silver: 0, bronze: 0 };
      if (e.place === 1) h.gold++;
      else if (e.place === 2) h.silver++;
      else h.bronze++;
      by.set(e.playerId, h);
    }
  }
  return [...by.values()].sort((a, b) => b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || b.last.localeCompare(a.last) || a.name.localeCompare(b.name));
}

// Stars of one player in a ranking (profile page).
export async function getPlayerStars(game: string, playerId: number): Promise<StarCount & { periods: (HallPeriod & { place: number })[] }> {
  const rows = await query<{ place: number; period_start: string | Date; period_end: string | Date; unit: string; every: number }>(
    `SELECT place, period_start, period_end, unit, every FROM hlstats_gamewe_hall_of_fame WHERE game = ? AND player_id = ? ORDER BY period_start DESC`,
    [game, playerId],
  );
  const periods = rows.map((r) => ({ place: Number(r.place), start: day(r.period_start), end: day(r.period_end), unit: unit(r.unit), every: every(r.every) }));
  return {
    gold: periods.filter((p) => p.place === 1).length,
    silver: periods.filter((p) => p.place === 2).length,
    bronze: periods.filter((p) => p.place === 3).length,
    periods,
  };
}

// Whether the ranking shows the hall of fame (tab, page, stars in profiles).
// Admin > Rankings sets it per ranking (hlstats_Options
// gamewe_hof_<game>: "1" on, "0" off). Unset it follows the reset schedule
// (gamewe_reset_schedule_<game>, e.g. "month", "2 week", "quarter"): on
// while one is set, and on while entries exist from an earlier schedule.
// Never without the table (a collector before the hall of fame). Every page
// of a ranking asks (the tab), so the answer is kept for 30 seconds.
const shownCache = new Map<string, { at: number; value: boolean }>();

export async function hallOfFameShown(game: string): Promise<boolean> {
  const hit = shownCache.get(game);
  if (hit && Date.now() - hit.at < 30_000) return hit.value;
  let value = false;
  try {
    const rows = await query<{ keyname: string; value: string }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [
      [`gamewe_hof_${game}`, `gamewe_reset_schedule_${game}`],
    ]);
    const o = Object.fromEntries(rows.map((r) => [r.keyname, (r.value ?? "").trim()]));
    const entries = (await query(`SELECT 1 AS x FROM hlstats_gamewe_hall_of_fame WHERE game = ? LIMIT 1`, [game])).length > 0;
    const set = o[`gamewe_hof_${game}`];
    value = set === "1" || (set !== "0" && (!!parseSchedule(o[`gamewe_reset_schedule_${game}`] ?? "") || entries));
  } catch {
    value = false;
  }
  shownCache.set(game, { at: Date.now(), value });
  return value;
}

export function invalidateHallOfFame() {
  shownCache.clear();
}
