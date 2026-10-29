// The plan of the collector's jobs as it writes it to hlstats_Options
// (collector 0.27.0): gamewe_next_awards and gamewe_next_inactive (JSON:
// on or off in its config.yaml, time of day, time zone, next run),
// gamewe_next_resets (time and zone of the scheduled resets) and
// gamewe_next_reset_<game> (Unix time the running period of the ranking's
// reset schedule ends). No database access, so it can be tested.

import { parseSchedule, type Schedule } from "./hall-period";

export const PLAN_KEYS = { awards: "gamewe_next_awards", inactive: "gamewe_next_inactive", resets: "gamewe_next_resets", bans: "gamewe_next_bans" } as const;
export const NEXT_RESET_PREFIX = "gamewe_next_reset_";

// The state of the collector's bans-sync job (collector "all-bans",
// features.bans_sync): Steam (key set, recheck in seconds, accounts due,
// checked, banned, last and next request) and the SourceBans list
// (features.sourcebans and an address set, interval in seconds, running
// bans, last and next read, last error).
export const BANS_PLAN_KEY = "gamewe_next_bans";

export type BansPlanPart = { enabled: boolean; every: number; due: number; checked: number; count: number; last: number; next: number; error: string };
export type BansPlan = { enabled: boolean; steam: BansPlanPart; sourcebans: BansPlanPart };

// The stored bans plan, or null for a missing or malformed value.
export function parseBansPlan(v: string | null | undefined): BansPlan | null {
  if (!v) return null;
  let o: unknown;
  try {
    o = JSON.parse(v);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object" || typeof (o as Record<string, unknown>).enabled !== "boolean") return null;
  const p = o as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x > 0 ? Math.floor(x) : 0);
  const part = (x: unknown, every: string, count: string): BansPlanPart => {
    const q = x && typeof x === "object" ? (x as Record<string, unknown>) : {};
    return {
      enabled: q.enabled === true,
      every: num(q[every]),
      due: num(q.due),
      checked: num(q.checked),
      count: num(q[count]),
      last: num(q.last),
      next: num(q.next),
      error: typeof q.error === "string" ? q.error.slice(0, 300) : "",
    };
  };
  return { enabled: p.enabled === true, steam: part(p.steam, "recheck", "banned"), sourcebans: part(p.sourcebans, "interval", "bans") };
}

export function nextResetKey(game: string): string {
  return NEXT_RESET_PREFIX + game;
}

export type JobPlan = { enabled: boolean; time: string; zone: string; next: number };

// A stored plan, or null for a missing or malformed value (a value the
// collector did not write: the row is writable in the admin's raw options).
export function parsePlan(v: string | null | undefined): JobPlan | null {
  if (!v) return null;
  let o: unknown;
  try {
    o = JSON.parse(v);
  } catch {
    return null;
  }
  if (!o || typeof o !== "object") return null;
  const p = o as Record<string, unknown>;
  if (typeof p.enabled !== "boolean" || typeof p.time !== "string" || !/^\d{2}:\d{2}$/.test(p.time)) return null;
  const zone = typeof p.zone === "string" && /^[A-Za-z0-9_+\-/]{1,64}$/.test(p.zone) ? p.zone : "";
  const next = typeof p.next === "number" && Number.isInteger(p.next) && p.next > 0 ? p.next : 0;
  return { enabled: p.enabled, time: p.time, zone, next };
}

// The Unix time of gamewe_next_reset_<game>, 0 if missing or malformed.
export function parseNext(v: string | null | undefined): number {
  const n = Number((v ?? "").trim());
  return Number.isInteger(n) && n > 0 ? n : 0;
}

// The schedule the collector uses for a ranking: its own key
// (gamewe_reset_schedule_<game>; "off" or "0" = none), else the one for
// all rankings (gamewe_reset_schedule).
export function effectiveSchedule(own: string | null | undefined, global: string | null | undefined): Schedule | null {
  const v = (own ?? "").trim();
  if (v) return ["off", "0"].includes(v.toLowerCase()) ? null : parseSchedule(v);
  return parseSchedule(global ?? "");
}

export type JobType = "reset" | "scheduled-reset" | "inactive" | "awards";
export const JOB_TYPES: readonly JobType[] = ["reset", "scheduled-reset", "inactive", "awards"];

export function jobType(v: string): JobType | null {
  return (JOB_TYPES as readonly string[]).includes(v) ? (v as JobType) : null;
}

// Seconds -> "45 s", "12 min", "3 h 5 min", "2 d 4 h".
export function shortDuration(seconds: number, lang: "de" | "en"): string {
  const s = Math.max(0, Math.round(seconds));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const day = lang === "de" ? "T" : "d";
  const hr = lang === "de" ? "Std." : "h";
  if (d > 0) return h ? `${d} ${day} ${h} ${hr}` : `${d} ${day}`;
  if (h > 0) return m ? `${h} ${hr} ${m} min` : `${h} ${hr}`;
  if (m > 0) return `${m} min`;
  return `${s} s`;
}
