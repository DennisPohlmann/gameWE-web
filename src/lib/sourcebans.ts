import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { env } from "./env";
import { steamIds } from "./format";

// Public ban list of a SourceBans / SourceBans++ installation, read from its
// web pages (index.php?p=banlist&page=N), since SourceBans has no public API.
// Understands the classic template (SourceBans 1.4 to SB++ 1.7) and the
// SB++ 2026 one. The address is set by an admin; it must be a public
// http(s) address (no localhost or LAN, unless SOURCEBANS_ALLOW_PRIVATE=1),
// the pages are read one after another with a pause, at most MAX_PAGES of
// them, and the result is kept for half an hour.

export type SbState = "permanent" | "active" | "expired" | "unbanned";

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

let cache: { base: string; at: number; ok: boolean; bans: SbBan[] } | null = null;
let inflight: Promise<void> | null = null;

// All bans on the list (newest first); null while the first load runs.
export async function getSourcebans(base: string): Promise<{ bans: SbBan[]; ok: boolean } | null> {
  if (!base) return null;
  const fresh = cache && cache.base === base && Date.now() - cache.at < (cache.ok ? TTL : RETRY);
  if (!fresh) {
    inflight ??= load(base).finally(() => (inflight = null));
    // The first load may take a while (up to MAX_PAGES pages); wait for it
    // a few seconds, later ones refresh in the background.
    if (!cache || cache.base !== base) await Promise.race([inflight, new Promise((r) => setTimeout(r, 8000))]);
  }
  return cache && cache.base === base ? { bans: cache.bans, ok: cache.ok } : null;
}

async function load(base: string) {
  const bans: SbBan[] = [];
  const seen = new Set<string>();
  let ok = true;
  try {
    await checkHost(new URL(base).hostname);
    for (let page = 1; page <= MAX_PAGES; page++) {
      const html = await fetchPage(`${base}index.php?p=banlist&page=${page}`);
      const found = parseBans(html);
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
  else cache = { base, at: Date.now(), ok, bans };
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

export function parseBans(html: string): SbBan[] {
  return html.includes('class="ban-row') ? parseNew(html) : parseClassic(html);
}

// SB++ 2026: one <tr class="ban-row ..." data-state="..."> per ban.
function parseNew(html: string): SbBan[] {
  const out: SbBan[] = [];
  for (const chunk of html.split('<tr class="ban-row').slice(1)) {
    const row = chunk.split(/<tr class="ban-row|<\/tbody>/)[0];
    const ids = steamOf(row);
    if (!ids) continue;
    const state = /data-state="([a-z]+)"/.exec(row)?.[1] ?? "";
    const reasonTd = /<td class="text-muted truncate"[^>]*?(?:title="([^"]*)")?[^>]*>([\s\S]*?)<\/td>/.exec(row);
    out.push({
      ...ids,
      name: text(/ban-player-cell__name"[^>]*>([\s\S]*?)<\/a>/.exec(row)?.[1]),
      reason: reasonTd ? text(reasonTd[1] ?? reasonTd[2].split("<div")[0]) : "",
      length: text(/<td class="col-length[^"]*"[^>]*>([\s\S]*?)<\/td>/.exec(row)?.[1]),
      date: /<time datetime="([^"]+)"/.exec(row)?.[1] ?? "",
      state: state === "permanent" || state === "active" || state === "expired" || state === "unbanned" ? state : "active",
    });
  }
  return out;
}

// Classic template: <tr class="opener ..."> with the summary, followed by a
// sliding panel with "Steam ID", "Invoked on", "Banlength", "Reason" rows.
function parseClassic(html: string): SbBan[] {
  const out: SbBan[] = [];
  for (const chunk of html.split(/<tr class="opener/).slice(1)) {
    const ids = steamOf(chunk);
    if (!ids) continue;
    const field = (label: string) =>
      text(new RegExp(`>\\s*${label}\\s*</td>\\s*<td[^>]*>([\\s\\S]*?)</td>`).exec(chunk)?.[1]);
    const cls = /class="listtable_1_(permanent|banned|unbanned)"[^>]*>([\s\S]*?)<\/td>/.exec(chunk);
    const length = field("Banlength") || text(cls?.[2]);
    const state: SbState =
      cls?.[1] === "permanent"
        ? "permanent"
        : cls?.[1] === "unbanned"
          ? /expired/i.test(length) ? "expired" : "unbanned"
          : "active";
    out.push({
      ...ids,
      name: field("Player").replace(/\s+/g, " "),
      reason: field("Reason"),
      length: length.replace(/\s*\((?:Unbanned|Expired|Deleted)\)\s*$/i, ""),
      date: field("Invoked on"),
      state,
    });
  }
  return out;
}

function steamOf(s: string) {
  const m = /STEAM_[0-5]:([01]):(\d{1,10})/.exec(s) ?? /steamcommunity\.com\/profiles\/(7656119\d{10})/.exec(s);
  const ids = m ? steamIds(m[0].startsWith("STEAM") ? `${m[1]}:${m[2]}` : m[1]) : null;
  return ids ? { steam64: ids.steam64, steam2: ids.steam2 } : null;
}

function text(s: string | undefined): string {
  return (s ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n) < 0x110000 ? Number(n) : 32))
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
