import "server-only";
import { adminExec, adminQuery, upsert, type Param } from "./db";
import { hiddenSql } from "./hidden";
import { lastStart, parseSchedule, scheduleValue, type Schedule } from "./hall-period";
import { resetMode, type ResetMode } from "./reset-modes";

// Admin settings of the scheduled ranking resets and the hall of fame, in
// hlstats_Options (read by the collector every minute):
// gamewe_reset_schedule / gamewe_reset_mode: the schedule for all rankings
// (gamewe_reset_paused: the schedule while it is switched off; the collector
// does not read it);
// gamewe_reset_schedule_<game> ("month", "2 week", "month@15", "off"; unset =
// as for all rankings), gamewe_reset_mode_<game>, gamewe_hof_<game> ("1",
// "0", unset = automatic) and, written by the collector,
// gamewe_reset_last_<game> (start of the running period and its schedule).

export type HallSource = "global" | "own" | "off";

// enabled: the schedule is on (gamewe_reset_schedule is set). schedule: the
// one stored, also while it is off. last: start of the running period of a
// ranking that follows it (0: not started yet).
export type GlobalHall = { enabled: boolean; schedule: Schedule | null; mode: ResetMode; last: number };

export type HallSettings = {
  table: boolean;
  removable: boolean; // collector migration 16: entries can be removed
  source: HallSource;
  schedule: Schedule | null; // own schedule (source "own")
  mode: ResetMode; // own mode
  global: { schedule: Schedule | null; mode: ResetMode }; // schedule null while off
  effective: Schedule | null; // the one the collector uses
  effectiveMode: ResetMode;
  page: "auto" | "on" | "off";
  last: number;
  entries: number;
};

const GLOBAL = { schedule: "gamewe_reset_schedule", mode: "gamewe_reset_mode", paused: "gamewe_reset_paused" };

const keys = (game: string) => ({
  schedule: `gamewe_reset_schedule_${game}`,
  mode: `gamewe_reset_mode_${game}`,
  page: `gamewe_hof_${game}`,
  last: `gamewe_reset_last_${game}`,
});

async function options(names: string[]): Promise<Record<string, string>> {
  const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [names]);
  return Object.fromEntries(rows.map((r) => [r.keyname, (r.value ?? "").trim()]));
}

function source(v: string | undefined): HallSource {
  if (!v) return "global";
  return ["off", "0"].includes(v.toLowerCase()) ? "off" : "own";
}

// The schedule for all rankings; games: the rankings (for last).
export async function globalHall(games: string[] = []): Promise<GlobalHall> {
  const o = await options([...Object.values(GLOBAL), ...games.flatMap((g) => [keys(g).schedule, keys(g).last])]);
  const active = parseSchedule(o[GLOBAL.schedule] ?? "");
  const following = games.filter((g) => !o[keys(g).schedule]);
  return {
    enabled: active !== null,
    schedule: active ?? parseSchedule(o[GLOBAL.paused] ?? ""),
    mode: resetMode(o[GLOBAL.mode]) ?? "player-stats",
    last: active ? Math.max(0, ...following.map((g) => lastStart(o[keys(g).last]))) : 0,
  };
}

export async function hallSettings(game: string): Promise<HallSettings> {
  const k = keys(game);
  const o = await options([...Object.values(k), ...Object.values(GLOBAL)]);
  let table = true;
  let entries = 0;
  try {
    const n = await adminQuery<{ n: number }>(`SELECT COUNT(DISTINCT period_start) AS n FROM hlstats_gamewe_hall_of_fame WHERE game = ?`, [game]);
    entries = Number(n[0]?.n ?? 0);
  } catch {
    table = false;
  }
  const global = { schedule: parseSchedule(o[GLOBAL.schedule] ?? ""), mode: resetMode(o[GLOBAL.mode]) ?? "player-stats" };
  const src = source(o[k.schedule]);
  const schedule = src === "own" ? parseSchedule(o[k.schedule]) : null;
  const mode = resetMode(o[k.mode]) ?? "player-stats";
  return {
    table,
    removable: table && (await hasRemoved()),
    source: src,
    schedule,
    mode,
    global,
    effective: src === "global" ? global.schedule : schedule,
    effectiveMode: src === "global" ? global.mode : mode,
    page: o[k.page] === "1" ? "on" : o[k.page] === "0" ? "off" : "auto",
    last: lastStart(o[k.last]),
    entries,
  };
}

async function hasRemoved(): Promise<boolean> {
  try {
    await adminQuery(`SELECT removed FROM hlstats_gamewe_hall_of_fame WHERE 1 = 0`);
    return true;
  } catch {
    return false;
  }
}

const set = (key: string, v: string) => adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, v]);
const del = (key: string) => adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [key]);

// Stores the settings of one ranking. The collector notices a changed
// schedule and starts it with the period now running (in its time zone)
// within a minute, so no reset happens at once; for collectors before 0.20
// the start of the running period is dropped too.
export async function saveHallSettings(game: string, src: HallSource, schedule: string, mode: ResetMode, page: HallSettings["page"]): Promise<void> {
  const k = keys(game);
  const before = await hallSettings(game);
  if (src === "own" && schedule) {
    await set(k.schedule, schedule);
    await set(k.mode, mode);
  } else if (src === "off") {
    await set(k.schedule, "off");
    await del(k.mode);
  } else {
    await del(k.schedule);
    await del(k.mode);
  }
  const after = src === "global" ? before.global.schedule : src === "own" ? parseSchedule(schedule) : null;
  if (scheduleValue(after) !== scheduleValue(before.effective)) await del(k.last);
  if (page === "auto") await del(k.page);
  else await set(k.page, page === "on" ? "1" : "0");
}

// Stores the schedule for all rankings, switched on or off. Off keeps it in
// gamewe_reset_paused for switching it on again. When the schedule in force
// changes, the rankings that follow it lose the start of their running
// period, so the collector starts the new one with the period now running
// instead of resetting at once for the time it was off (collector 0.26.1
// forgets it by itself while there is no schedule).
export async function saveGlobalHall(enabled: boolean, schedule: string, mode: ResetMode): Promise<void> {
  const before = await options([GLOBAL.schedule]);
  if (enabled) {
    await set(GLOBAL.schedule, schedule);
    await del(GLOBAL.paused);
  } else {
    await del(GLOBAL.schedule);
    await set(GLOBAL.paused, schedule);
  }
  await set(GLOBAL.mode, mode);
  const now = enabled ? schedule : "";
  if (scheduleValue(parseSchedule(before[GLOBAL.schedule] ?? "")) === now) return;
  const games = (await adminQuery<{ code: string }>(`SELECT code FROM hlstats_Games`)).map((r) => r.code.trim());
  for (const g of await inheritingRankings(games)) await del(keys(g).last);
}

// The rankings that follow the schedule for all rankings (no own key).
export async function inheritingRankings(games: string[]): Promise<string[]> {
  if (!games.length) return [];
  const own = await options(games.map((g) => keys(g).schedule));
  return games.filter((g) => !own[keys(g).schedule]);
}

// ---------------------------------------------------------------- editing

export type HallEditEntry = {
  place: number;
  playerId: number;
  name: string;
  currentName: string | null;
  skill: number;
  kills: number;
  removed: boolean;
  hidden: boolean;
};
export type HallEditPeriod = { unit: string; every: number; start: string; end: string; entries: HallEditEntry[] };

const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

// All stored entries of a ranking (all places, removed ones too), newest
// period first.
export async function hallEntries(game: string): Promise<HallEditPeriod[]> {
  const removed = (await hasRemoved()) ? "h.removed" : "0";
  const rows = await adminQuery<{
    unit: string;
    every: number;
    period_start: unknown;
    period_end: unknown;
    place: number;
    player_id: number;
    name: string;
    skill: number;
    kills: number;
    removed: number;
    hidden: number;
    current_name: string | null;
  }>(
    `SELECT h.unit, h.every, h.period_start, h.period_end, h.place, h.player_id, h.name, h.skill, h.kills, ${removed} AS removed,
            CASE WHEN ${hiddenSql("h.player_id")} THEN 1 ELSE 0 END AS hidden, d.lastName AS current_name
     FROM hlstats_gamewe_hall_of_fame h
     LEFT JOIN hlstats_Players_Data d ON d.playerId = h.player_id
     WHERE h.game = ?
     ORDER BY h.period_start DESC, h.place`,
    [game],
  );
  const out: HallEditPeriod[] = [];
  for (const r of rows) {
    const start = day(r.period_start);
    let p = out.at(-1);
    if (!p || p.start !== start) {
      p = { unit: r.unit, every: Number(r.every), start, end: day(r.period_end), entries: [] };
      out.push(p);
    }
    p.entries.push({
      place: Number(r.place),
      playerId: Number(r.player_id),
      name: r.name,
      currentName: r.current_name,
      skill: Number(r.skill),
      kills: Number(r.kills),
      removed: Number(r.removed) !== 0,
      hidden: Number(r.hidden) !== 0,
    });
  }
  return out;
}

// Removes (or brings back) one entry, or all entries of a period when place
// is null. Returns the number of rows changed. Only the column removed is
// written (gamewe_web_admin may update nothing else in this table).
export async function setHallRemoved(game: string, start: string, place: number | null, removed: boolean): Promise<number> {
  const args: Param[] = [removed ? 1 : 0, game, start];
  let sql = `UPDATE hlstats_gamewe_hall_of_fame SET removed = ? WHERE game = ? AND period_start = ?`;
  if (place !== null) {
    sql += ` AND place = ?`;
    args.push(place);
  }
  return (await adminExec(sql, args)).affectedRows;
}
