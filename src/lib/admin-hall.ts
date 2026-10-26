import "server-only";
import { adminExec, adminQuery, upsert } from "./db";
import { parseSchedule, type HallUnit } from "./hall-period";
import { resetMode, type ResetMode } from "./reset-modes";

// Admin settings of the scheduled ranking reset and the hall of fame of one
// ranking, in hlstats_Options (read by the collector every minute):
// gamewe_reset_schedule_<game> ("month", "2 week", ...), gamewe_reset_mode_<game>,
// gamewe_hof_<game> ("1", "0", unset = automatic) and, written by the
// collector, gamewe_reset_last_<game> (start of the running period).

export type HallSettings = {
  table: boolean;
  schedule: { unit: HallUnit; every: number } | null;
  mode: ResetMode;
  page: "auto" | "on" | "off";
  last: number;
  entries: number;
};

const keys = (game: string) => ({
  schedule: `gamewe_reset_schedule_${game}`,
  mode: `gamewe_reset_mode_${game}`,
  page: `gamewe_hof_${game}`,
  last: `gamewe_reset_last_${game}`,
});

export async function hallSettings(game: string): Promise<HallSettings> {
  const k = keys(game);
  const rows = await adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`, [Object.values(k)]);
  const o = Object.fromEntries(rows.map((r) => [r.keyname, (r.value ?? "").trim()]));
  let table = true;
  let entries = 0;
  try {
    const n = await adminQuery<{ n: number }>(`SELECT COUNT(DISTINCT period_start) AS n FROM hlstats_gamewe_hall_of_fame WHERE game = ?`, [game]);
    entries = Number(n[0]?.n ?? 0);
  } catch {
    table = false;
  }
  return {
    table,
    schedule: parseSchedule(o[k.schedule] ?? ""),
    mode: resetMode(o[k.mode]) ?? "player-stats",
    page: o[k.page] === "1" ? "on" : o[k.page] === "0" ? "off" : "auto",
    last: Number(o[k.last]) || 0,
    entries,
  };
}

// Stores the settings. A changed schedule drops the start of the running
// period: the collector then starts the new schedule with the period now
// running (in its time zone) within a minute, so no reset happens at once.
export async function saveHallSettings(game: string, schedule: string, mode: ResetMode, page: HallSettings["page"]): Promise<void> {
  const k = keys(game);
  const old = await adminQuery<{ value: string | null }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [k.schedule]);
  const set = (key: string, v: string) => adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, v]);
  const del = (key: string) => adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [key]);
  if (schedule) {
    await set(k.schedule, schedule);
    await set(k.mode, mode);
  } else {
    await del(k.schedule);
    await del(k.mode);
  }
  if ((old[0]?.value ?? "").trim() !== schedule) await del(k.last);
  if (page === "auto") await del(k.page);
  else await set(k.page, page === "on" ? "1" : "0");
}
