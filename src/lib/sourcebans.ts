import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "./env";
import { steamIds } from "./format";
import { hasSteamIds, parseBans as parseRaw, type SbState } from "./sourcebans-parse";

// Public ban list of a SourceBans / SourceBans++ installation, read from its
// web pages (index.php?p=banlist&page=N), since SourceBans has no public API.
// Understands the classic template (SourceBans 1.4 to SB++ 1.7), the
// SB++ 1.8 default theme and the SB++ 2026 one (sourcebans-parse.ts). The address is set by an admin; it must be a public
// http(s) address (no localhost or LAN, unless SOURCEBANS_ALLOW_PRIVATE=1),
// the pages are read one after another with a pause, at most MAX_PAGES of
// them, and the result is kept for half an hour.

export type { SbState };

export type SbBan = {
  steam64: string;
  steam2: string;
  name: string;
  reason: string;
  length: string;
  date: string;
  state: SbState;
};

const MAX_PAGES = 100;
const MAX_BYTES = 3 * 1024 * 1024;
const TTL = 30 * 60 * 1000;
const RETRY = 5 * 60 * 1000;

// The base address from the setting: http(s) only, no user/password, ends with "/".
export function sourcebansBase(v: string | undefined): string {
  const s = (v ?? "").trim();
  if (!s || (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s))) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password) return "";
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname.replace(/index\.php$/i, "").replace(/\/?$/, "/");
    return u.toString();
  } catch {
    return "";
  }
}

// unknown: the first page shows Steam IDs but no ban could be read from it
// (a template this code does not know), so an empty list means nothing.
let cache: { base: string; at: number; ok: boolean; unknown: boolean; bans: SbBan[] } | null = null;
let inflight: Promise<void> | null = null;

// All bans on the list (newest first); null while the first load runs.
export async function getSourcebans(base: string): Promise<{ bans: SbBan[]; ok: boolean; unknown: boolean } | null> {
  if (!base) return null;
  const fresh = cache && cache.base === base && Date.now() - cache.at < (cache.ok ? TTL : RETRY);
  if (!fresh) {
    inflight ??= load(base).finally(() => (inflight = null));
    // The first load may take a while (up to MAX_PAGES pages); wait for it
    // a few seconds, later ones refresh in the background.
    if (!cache || cache.base !== base) await Promise.race([inflight, new Promise((r) => setTimeout(r, 8000))]);
  }
  return cache && cache.base === base ? { bans: cache.bans, ok: cache.ok, unknown: cache.unknown } : null;
}

// The bans read last, without waiting (null before the first load, which
// this starts); for pages that must not wait for the ban list.
export function peekSourcebans(base: string): { bans: SbBan[] } | null {
  if (!base) return null;
  void getSourcebans(base).catch(() => undefined);
  return cache && cache.base === base ? { bans: cache.bans } : null;
}

async function load(base: string) {
  const bans: SbBan[] = [];
  const seen = new Set<string>();
  let ok = true;
  let unknown = false;
  try {
    await checkHost(new URL(base).hostname);
    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchPage(`${base}index.php?p=banlist&page=${page}`);
      const found = parseBans(html);
      if (page === 1 && !found.length && hasSteamIds(html)) {
        unknown = true;
        console.warn(`SourceBans: ${base}index.php?p=banlist shows Steam IDs, but no ban could be read (unknown template)`);
      }
      let added = 0;
      for (const b of found) {
        const key = `${b.steam64}|${b.date}|${b.reason}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bans.push(b);
        added++;
      }
      // Past the last page SourceBans repeats it or shows nothing.
      if (!added) break;
      await new Promise((r) => setTimeout(r, 400));
    }
  } catch (e) {
    ok = false;
    console.warn(`SourceBans: ${e instanceof Error ? e.message : e}`);
  }
  // A failed refresh keeps the bans read before.
  if (!ok && cache?.base === base && cache.bans.length) cache = { ...cache, at: Date.now(), ok: false };
  else cache = { base, at: Date.now(), ok, unknown, bans };
}

async function fetchPage(url: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    redirect: "manual",
    cache: "no-store",
    headers: { "user-agent": "gameWE stats", accept: "text/html" },
  });
  if (res.status >= 300 && res.status < 400) throw new Error(`redirect from ${url}; set the final address`);
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  const reader = res.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      throw new Error(`page larger than ${MAX_BYTES} bytes`);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

// Only public addresses, so the setting cannot be used to reach the
// server's own services or the LAN.
async function checkHost(host: string) {
  if (env("SOURCEBANS_ALLOW_PRIVATE") === "1") return;
  const name = host.replace(/^\[|\]$/g, "");
  const addrs = isIP(name) ? [{ address: name }] : await lookup(name, { all: true });
  if (!addrs.length) throw new Error(`${host} not found`);
  for (const a of addrs) if (privateIp(a.address)) throw new Error(`${host} is not a public address`);
}

export function privateIp(ip: string): boolean {
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/i.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const s = ip.toLowerCase();
  return s === "::" || s === "::1" || /^f[cd]/.test(s) || /^fe[89ab]/.test(s) || /^ff/.test(s) || s.startsWith("::ffff:") || s.startsWith("64:ff9b:");
}

// ---------------------------------------------------------------- parsing

// The bans of one page with their Steam IDs converted; bans without a valid
// Steam ID are left out.
export function parseBans(html: string): SbBan[] {
  return parseRaw(html).flatMap(({ steam, ...b }) => {
    const ids = steamIds(steam);
    return ids ? [{ ...b, steam64: ids.steam64, steam2: ids.steam2 }] : [];
  });
}
