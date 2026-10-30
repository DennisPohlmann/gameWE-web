// Which feature queued a job of hlstats_gamewe_jobs and why (collector
// schema version 22, "job-origin"): the column origin names the feature
// (scheduled_resets, daily_awards, inactive_players, cli; the web writes
// admin and api), origin_detail holds the details as JSON (period and
// schedule of a scheduled reset, queued at the collector's start, the day of
// the awards, the gamewe command, the API token). Jobs queued before have
// both empty; then only requested_by is known. No database access, so it
// can be tested.

import { parseSchedule, type Schedule } from "./hall-period";

export const ORIGINS = ["scheduled_resets", "daily_awards", "inactive_players", "cli", "admin", "api"] as const;
export type Origin = (typeof ORIGINS)[number];

export type JobOrigin = {
  feature: Origin | ""; // "" for jobs before the columns, or an unknown value
  startup: boolean; // queued by the collector's first look at its schedule after its start
  from: number; // period of a scheduled reset that ended, [from, to) as Unix times
  to: number;
  schedule: Schedule | null;
  inherited: boolean; // the ranking follows the schedule for all rankings
  zone: string; // time zone of the period
  day: string; // day of the daily awards (YYYY-MM-DD)
  command: string; // gamewe command
  token: string; // name of the API token
  version: string; // collector version
};

const ZONE = /^[A-Za-z0-9_+\-/]{1,64}$/;

function validZone(z: string): boolean {
  if (!ZONE.test(z)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: z });
    return true;
  } catch {
    return false;
  }
}

// The origin of a row; malformed values only lose the details (the row is
// written by the collector, the web and, with database rights, by hand).
export function parseJobOrigin(feature: string | null | undefined, detail: string | null | undefined): JobOrigin {
  const f = (feature ?? "").trim();
  const o: JobOrigin = {
    feature: (ORIGINS as readonly string[]).includes(f) ? (f as Origin) : "",
    startup: false,
    from: 0,
    to: 0,
    schedule: null,
    inherited: false,
    zone: "",
    day: "",
    command: "",
    token: "",
    version: "",
  };
  let d: unknown;
  try {
    d = detail ? JSON.parse(detail) : null;
  } catch {
    return o;
  }
  if (!d || typeof d !== "object" || Array.isArray(d)) return o;
  const p = d as Record<string, unknown>;
  const unix = (x: unknown) => (typeof x === "number" && Number.isInteger(x) && x > 0 ? x : 0);
  const text = (x: unknown, max: number) => (typeof x === "string" ? x.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
  o.startup = p.startup === true;
  o.from = unix(p.from);
  o.to = unix(p.to);
  if (!(o.from && o.to > o.from)) o.from = o.to = 0;
  o.schedule = typeof p.schedule === "string" ? parseSchedule(p.schedule) : null;
  o.inherited = p.inherited === true;
  o.zone = typeof p.zone === "string" && validZone(p.zone) ? p.zone : "";
  o.day = typeof p.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.day) ? p.day : "";
  o.command = text(p.command, 200);
  o.token = text(p.token, 64);
  o.version = typeof p.version === "string" && /^[0-9A-Za-z.+-]{1,32}$/.test(p.version) ? p.version : "";
  return o;
}

// origin_detail of a job the web queues (an API token's name, or nothing).
export function webOriginDetail(token: string | undefined): string {
  return token ? JSON.stringify({ token: token.slice(0, 64) }) : "";
}

const T = {
  de: {
    sources: {
      scheduled_resets: "Reset-Zeitplan (features.scheduled_resets)",
      daily_awards: "Tägliche Awards (features.daily_awards)",
      inactive_players: "Täglicher Lauf der inaktiven Spieler (features.inactive_players)",
      cli: "Konsole",
      admin: "Web-Admin",
      api: "Admin-API",
    } as Record<Origin, string>,
    schedule: "Collector-Zeitplan",
    period: "Periode {f} bis {t}",
    own: "eigener Zeitplan des Rankings",
    all: "Zeitplan für alle Rankings",
    startup: "beim Start des Collectors angelegt",
    ended: "angelegt, als die Periode endete",
    dailyStartup: "beim Start des Collectors angelegt, der Tag hatte noch keine Awards",
    daily: "zur täglichen Uhrzeit angelegt",
    token: "Token „{n}“",
    old: "keine Details: von einem älteren Collector angelegt",
  },
  en: {
    sources: {
      scheduled_resets: "Reset schedule (features.scheduled_resets)",
      daily_awards: "Daily awards (features.daily_awards)",
      inactive_players: "Daily move of inactive players (features.inactive_players)",
      cli: "Console",
      admin: "Web admin",
      api: "Admin API",
    } as Record<Origin, string>,
    schedule: "Collector schedule",
    period: "period {f} to {t}",
    own: "the ranking's own schedule",
    all: "schedule for all rankings",
    startup: "queued at the collector's start",
    ended: "queued when the period ended",
    dailyStartup: "queued at the collector's start, the day had no awards yet",
    daily: "queued at the daily time",
    token: "token “{n}”",
    old: "no details: queued by an older collector",
  },
};

const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w)\}/g, (_, k: string) => v[k] ?? "");

export type OriginText = { source: string; parts: string[] };

// What the admin shows for a job's origin: the source ("Reset schedule
// (features.scheduled_resets)") and the details. by: who queued it as the
// page may show it (requested_by, or "an admin" for other admins' jobs);
// scheduleText describes a schedule ("quarterly").
export function originText(
  o: JobOrigin,
  requestedBy: string,
  by: string,
  lang: "de" | "en",
  scheduleText: (s: Schedule) => string,
): OriginText {
  const t = T[lang];
  const locale = lang === "de" ? "de-DE" : "en-GB";
  const date = (unix: number) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: o.zone || undefined }).format(unix * 1000);
  const parts: string[] = [];
  switch (o.feature) {
    case "scheduled_resets":
    case "cli":
      if (o.from) parts.push(fill(t.period, { f: date(o.from), t: date(o.to - 1) }));
      if (o.schedule) parts.push(`${scheduleText(o.schedule)} (${o.inherited ? t.all : t.own})`);
      if (o.feature === "cli") {
        if (o.command) parts.unshift(o.command);
        break;
      }
      parts.push(o.startup ? t.startup : t.ended);
      break;
    case "daily_awards":
      // The day is in the job's own line (its mode).
      parts.push(o.startup ? t.dailyStartup : t.daily);
      break;
    case "admin":
      if (by) parts.push(by);
      break;
    case "api":
      if (o.token && by === requestedBy) parts.push(fill(t.token, { n: o.token }));
      if (by) parts.push(by);
      break;
    case "inactive_players":
      break;
    default:
      // Before the columns: only requested_by ("schedule" from the
      // collector, "cli" from a gamewe command, else an admin's name).
      if (requestedBy === "schedule") return { source: t.schedule, parts: [t.old] };
      if (requestedBy === "cli") return { source: t.sources.cli, parts: [t.old] };
      return { source: t.sources.admin, parts: by ? [by] : [] };
  }
  return { source: t.sources[o.feature], parts };
}
