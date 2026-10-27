import "server-only";
import { steamApiKey, steamKey } from "./config";
import { query } from "./db";
import { getSettings } from "./settings";

// Public Steam community profile of a player (avatar, name, VAC status ...).
// With a Steam Web API key (Admin → Settings → Steam, before that
// STEAM_API_KEY in the environment) the Steam Web API is used (up to 100 players per call);
// without it the XML view of steamcommunity.com, which needs no key but
// blocks many requests in a row, so those calls are throttled and paused
// after a refusal. Results are kept for a day; a failed or slow lookup just
// leaves the fields out and is retried later.

export type SteamProfile = {
  name: string | null;
  avatar: string | null;
  avatarSmall: string | null;
  realName: string | null;
  location: string | null;
  memberSince: string | null;
  vacBanned: boolean;
  onlineState: string | null;
  privacy: string | null;
};

const TTL = 24 * 3600 * 1000;
const RETRY = 10 * 60 * 1000;
const cache = new Map<string, { at: number; value: SteamProfile | null }>();
const inflight = new Map<string, Promise<SteamProfile | null>>();

function remember(steam64: string, value: SteamProfile | null, retryIn = RETRY) {
  if (cache.size > 20000) cache.clear();
  // Failures are retried after retryIn, not a day.
  cache.set(steam64, { at: value ? Date.now() : Date.now() - TTL + retryIn, value });
}

export async function getSteamProfile(steam64: string): Promise<SteamProfile | null> {
  if (!/^\d{17}$/.test(steam64) || !(await getSettings()).steamProfiles) return null;
  const hit = cache.get(steam64);
  if (hit && Date.now() - hit.at < TTL) return hit.value;
  let p = inflight.get(steam64);
  if (!p) {
    const key = await apiKey();
    // Another call may have started the same lookup while the key was read.
    p = inflight.get(steam64);
    if (p) return p;
    p = (key ? viaApi(steam64) : viaXml(steam64)).finally(() => inflight.delete(steam64));
    inflight.set(steam64, p);
  }
  return p;
}

// The key from gamewe_steam_api_key, else STEAM_API_KEY; read with the
// public (SELECT-only) user and kept for 30 seconds. Never logged or sent to
// the browser.
let keyCache: { at: number; value: string | null } | null = null;

async function apiKey(): Promise<string | null> {
  if (keyCache && Date.now() - keyCache.at < 30_000) return keyCache.value;
  let stored: string | undefined;
  try {
    stored = (await query<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, ["gamewe_steam_api_key"]))[0]?.value;
  } catch {
    // Database down: the environment alone.
  }
  keyCache = { at: Date.now(), value: steamApiKey(stored) };
  return keyCache.value;
}

// Whether a valid key is stored in the database (gamewe_steam_api_key):
// the collector's VAC block (hlstats_Games.block_vac) reads only that one,
// not STEAM_API_KEY of the website's environment. The key is not returned.
export async function steamKeyStored(): Promise<boolean> {
  try {
    const v = (await query<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, ["gamewe_steam_api_key"]))[0]?.value;
    return steamKey(v) !== null;
  } catch {
    return false;
  }
}

// After saving the Steam settings (admin action).
export function invalidateSteamKey() {
  keyCache = null;
}

// ---------------------------------------------------------------- Web API

let batch: { ids: Set<string>; done: Promise<void> } | null = null;

async function viaApi(steam64: string): Promise<SteamProfile | null> {
  if (!batch || batch.ids.size >= 100) {
    const ids = new Set<string>();
    // Collect the requests of the next 30 ms into one call.
    const done = new Promise<void>((r) => setTimeout(r, 30)).then(() => {
      if (batch?.ids === ids) batch = null;
      return loadBatch([...ids]);
    });
    batch = { ids, done };
  }
  batch.ids.add(steam64);
  await batch.done;
  return cache.get(steam64)?.value ?? null;
}

type Summary = {
  steamid: string;
  personaname?: string;
  avatarfull?: string;
  avatarmedium?: string;
  realname?: string;
  loccountrycode?: string;
  timecreated?: number;
  personastate?: number;
  communityvisibilitystate?: number;
};

async function loadBatch(ids: string[]) {
  const key = await apiKey();
  if (!key || !ids.length) return;
  const q = ids.join(",");
  try {
    const [sum, bans] = await Promise.all([
      steamJson<{ response?: { players?: Summary[] } }>(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${key}&steamids=${q}`),
      steamJson<{ players?: BanReply[] }>(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&steamids=${q}`),
    ]);
    const vac = new Map((bans?.players ?? []).map((b) => [b.SteamId, !!b.VACBanned]));
    // The same answer fills the ban list's cache, so the profile's
    // getSteamBans needs no second request.
    rememberBans(bans?.players ?? []);
    const found = new Map((sum?.response?.players ?? []).map((s) => [s.steamid, s]));
    for (const id of ids) {
      const s = found.get(id);
      remember(
        id,
        s
          ? {
              name: s.personaname || null,
              avatar: httpsOnly(s.avatarfull),
              avatarSmall: httpsOnly(s.avatarmedium),
              realName: s.realname || null,
              location: s.loccountrycode || null,
              memberSince: s.timecreated ? new Date(s.timecreated * 1000).toISOString().slice(0, 10) : null,
              vacBanned: vac.get(id) ?? false,
              onlineState: s.personastate ? "online" : "offline",
              privacy: s.communityvisibilitystate === 3 ? "public" : "private",
            }
          : null,
        sum ? RETRY : 2 * 60 * 1000,
      );
    }
  } catch {
    for (const id of ids) remember(id, null, 2 * 60 * 1000);
  }
}

async function steamJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

function httpsOnly(u: string | undefined): string | null {
  return u && /^https:\/\//.test(u) ? u : null;
}

// ---------------------------------------------------------------- XML view

// At most two requests at a time, a short gap between them, and a pause of
// ten minutes when Steam refuses (429/403/5xx). A request that would wait
// longer than eight seconds gives up and is retried two minutes later.
const XML_PARALLEL = 2;
const XML_GAP = 250;
let running = 0;
let lastStart = 0;
let pausedUntil = 0;
const waiting: (() => void)[] = [];

function slot(): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      const i = waiting.indexOf(go);
      if (i >= 0) waiting.splice(i, 1);
      resolve(false);
    }, 8000);
    const go = () => {
      clearTimeout(timer);
      running++;
      const wait = Math.max(0, lastStart + XML_GAP - Date.now());
      lastStart = Date.now() + wait;
      setTimeout(() => resolve(true), wait);
    };
    waiting.push(go);
    pump();
  });
}

function pump() {
  while (running < XML_PARALLEL && waiting.length) waiting.shift()!();
}

function release() {
  running--;
  pump();
}

async function viaXml(steam64: string): Promise<SteamProfile | null> {
  if (Date.now() < pausedUntil) return null;
  if (!(await slot())) {
    remember(steam64, null, 2 * 60 * 1000);
    return null;
  }
  let value: SteamProfile | null = null;
  try {
    if (Date.now() < pausedUntil) return null;
    const res = await fetch(`https://steamcommunity.com/profiles/${steam64}/?xml=1`, {
      signal: AbortSignal.timeout(3000),
      headers: { "user-agent": "gameWE stats" },
      cache: "no-store",
    });
    if (res.status === 429 || res.status === 403 || res.status >= 500) {
      pausedUntil = Date.now() + RETRY;
      return null;
    }
    if (res.ok) {
      const xml = await res.text();
      if (xml.includes("<profile>")) {
        value = {
          name: tag(xml, "steamID"),
          avatar: httpsOnly(tag(xml, "avatarFull") ?? undefined),
          avatarSmall: httpsOnly(tag(xml, "avatarMedium") ?? undefined),
          realName: tag(xml, "realname"),
          location: tag(xml, "location"),
          memberSince: tag(xml, "memberSince"),
          vacBanned: tag(xml, "vacBanned") === "1",
          onlineState: tag(xml, "onlineState"),
          privacy: tag(xml, "privacyState"),
        };
      }
    }
  } catch {
    value = null;
  } finally {
    release();
  }
  remember(steam64, value);
  return value;
}

function tag(xml: string, name: string): string | null {
  const m = new RegExp(`<${name}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${name}>`).exec(xml);
  const v = m?.[1]?.trim();
  return v ? decode(v) : null;
}

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

// ---------------------------------------------------------------- bans

// VAC and game bans of many players at once (Web API only, 100 per call),
// for the bans page. Kept for 12 hours.
export type SteamBans = { vac: number; game: number; days: number; community: boolean };

const BAN_TTL = 12 * 3600 * 1000;
const banCache = new Map<string, { at: number; value: SteamBans }>();

export async function steamBansAvailable(): Promise<boolean> {
  return (await getSettings()).steamProfiles && (await apiKey()) !== null;
}

export async function getSteamBans(ids: string[]): Promise<Map<string, SteamBans>> {
  const out = new Map<string, SteamBans>();
  const key = (await getSettings()).steamProfiles ? await apiKey() : null;
  if (!key) return out;
  const missing: string[] = [];
  for (const id of new Set(ids.filter((x) => /^\d{17}$/.test(x)))) {
    const hit = banCache.get(id);
    if (hit && Date.now() - hit.at < BAN_TTL) out.set(id, hit.value);
    else missing.push(id);
  }
  for (let i = 0; i < missing.length; i += 100) {
    const part = missing.slice(i, i + 100);
    const res = await steamJson<{ players?: BanReply[] }>(`https://api.steampowered.com/ISteamUser/GetPlayerBans/v1/?key=${key}&steamids=${part.join(",")}`).catch(() => null);
    if (!res) break;
    for (const [id, value] of rememberBans(res.players ?? [])) out.set(id, value);
  }
  return out;
}

type BanReply = { SteamId: string; VACBanned?: boolean; NumberOfVACBans?: number; NumberOfGameBans?: number; DaysSinceLastBan?: number; CommunityBanned?: boolean };

function rememberBans(players: BanReply[]): [string, SteamBans][] {
  if (banCache.size > 50000) banCache.clear();
  return players.map((p) => {
    const value = { vac: p.NumberOfVACBans ?? 0, game: p.NumberOfGameBans ?? 0, days: p.DaysSinceLastBan ?? 0, community: !!p.CommunityBanned };
    banCache.set(p.SteamId, { at: Date.now(), value });
    return [p.SteamId, value];
  });
}
