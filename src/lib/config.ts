import { env } from "./env";
import { isLang, type Lang } from "../translations/languages";
import { DEFAULT_PAGE_SIZE, pageSizeStep } from "./page-size";

// Site settings that older installations set in the environment. They live in
// hlstats_Options now (Admin → Settings); each one is read in this order: the
// value stored in the database, else the old environment variable (so an
// existing web.env keeps working until the setting is saved once), else the
// default. lib/settings.ts and lib/steam.ts read the database and call these.

type Get = (name: string) => string | undefined;

// Database key and environment variable of each setting.
export const ENV_FALLBACK = {
  sitename: "SITE_NAME",
  gamewe_default_lang: "DEFAULT_LANG",
  MinActivity: "ACTIVITY_DAYS",
  gamewe_page_size: "PAGE_SIZE",
  gamewe_steam_profiles: "STEAM_PROFILES",
  gamewe_steam_api_key: "STEAM_API_KEY",
} as const;

export const DEFAULTS = { siteName: "gameWE", defaultLang: "de" as Lang, activityDays: 28, pageSize: DEFAULT_PAGE_SIZE, steamProfiles: true };

const set = (v: string | undefined) => (v ?? "").trim();

function int(v: string | undefined, max: number): number | null {
  const s = set(v);
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? Math.min(n, max) : null;
}

function lang(v: string | undefined): Lang | null {
  const s = set(v).toLowerCase();
  return isLang(s) ? s : null;
}

// "1"/"0" in the database, "on"/"off" (also 1/0, true/false) in the environment.
function onOff(v: string | undefined): boolean | null {
  const s = set(v).toLowerCase();
  if (s === "1" || s === "on" || s === "true" || s === "yes") return true;
  if (s === "0" || s === "off" || s === "false" || s === "no") return false;
  return null;
}

// A Steam Web API key is 32 hex digits; anything else counts as not set.
export function steamKey(v: string | undefined): string | null {
  const s = set(v);
  return /^[0-9A-Fa-f]{32}$/.test(s) ? s : null;
}

export type EnvBacked = { siteName: string; defaultLang: Lang; activityDays: number; pageSize: number; steamProfiles: boolean };

// o: the hlstats_Options rows by key (empty when the database is down).
export function envBacked(o: Record<string, string | undefined>, get: Get = env): EnvBacked {
  return {
    siteName: set(o.sitename) || set(get("SITE_NAME")) || DEFAULTS.siteName,
    defaultLang: lang(o.gamewe_default_lang) ?? lang(get("DEFAULT_LANG")) ?? DEFAULTS.defaultLang,
    activityDays: int(o.MinActivity, 3650) ?? int(get("ACTIVITY_DAYS"), 3650) ?? DEFAULTS.activityDays,
    pageSize: pageSizeStep(o.gamewe_page_size) ?? pageSizeStep(get("PAGE_SIZE")) ?? DEFAULTS.pageSize,
    steamProfiles: onOff(o.gamewe_steam_profiles) ?? onOff(get("STEAM_PROFILES")) ?? DEFAULTS.steamProfiles,
  };
}

// The Steam Web API key: database, else STEAM_API_KEY. Server only: never
// pass it to a client component, a log line or an error message.
export function steamApiKey(stored: string | undefined, get: Get = env): string | null {
  return steamKey(stored) ?? steamKey(get("STEAM_API_KEY"));
}

// Where a setting's value comes from, for the admin form: "db" when stored,
// "env" when only the old environment variable sets it, else "default".
export function valueSource(key: keyof typeof ENV_FALLBACK, stored: string | undefined, get: Get = env): "db" | "env" | "default" {
  const ok = key === "gamewe_steam_api_key" ? (v: string | undefined) => steamKey(v) !== null : (v: string | undefined) => set(v) !== "";
  if (ok(stored)) return "db";
  return ok(get(ENV_FALLBACK[key])) ? "env" : "default";
}

// What the admin form shows for a setting that is not stored yet: the value
// of the old environment variable (saving the form moves it into the
// database), else the default. Never the Steam API key.
export function envFormValues(get: Get = env): Record<string, string> {
  const b = envBacked({}, get);
  return {
    sitename: set(get("SITE_NAME")),
    gamewe_default_lang: b.defaultLang,
    MinActivity: String(b.activityDays),
    gamewe_page_size: String(b.pageSize),
    gamewe_steam_profiles: b.steamProfiles ? "1" : "0",
  };
}
