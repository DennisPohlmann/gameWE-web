import "server-only";
import { adminQuery } from "./db";
import { REPOS, isNewer, parseRelease, parseVersion, type Component, type Release } from "./update-version";

// Update check of the admin area: the latest GitHub release of the web and
// the collector against the running versions (the web's APP_VERSION, the
// collector's gamewe_collector_version in hlstats_Options, written at its
// start). Asked server-side without a token (GitHub allows 60 requests an
// hour per IP), kept for an hour, after a failure retried after 10 minutes;
// offline or slow it shows nothing. Admin → Settings → Monitoring turns it
// off (gamewe_update_check = 0). Nothing is downloaded or installed.

const TTL = 3600 * 1000;
const RETRY = 600 * 1000;
const WAIT = 4000;

export type Update = { component: Component; current: string; latest: string; url: string };

type Entry = { at: number; ok: boolean; value: Release | null };

// On globalThis like the database pools (db.ts): Next.js may load this
// module once per route, and the overview's answer must reach the frame of
// every other admin page.
declare global {
  var __gameweUpdateCache: Map<Component, Entry> | undefined;
  var __gameweUpdateInflight: Map<Component, Promise<Release | null>> | undefined;
}
const cache = (globalThis.__gameweUpdateCache ??= new Map());
const inflight = (globalThis.__gameweUpdateInflight ??= new Map());

async function fetchLatest(c: Component): Promise<Release | null> {
  const repo = REPOS[c];
  let value: Release | null = null;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
      signal: AbortSignal.timeout(WAIT),
      cache: "no-store",
      headers: { Accept: "application/vnd.github+json", "User-Agent": "gamewe-web" },
    });
    if (res.ok) value = parseRelease(repo, await res.json());
    else console.warn(`update check: GitHub answered HTTP ${res.status} for ${repo}`);
  } catch (e) {
    // offline, DNS, timeout: one line in the log, the admin area says so
    console.warn(`update check: GitHub not reachable for ${repo} (${e instanceof Error ? e.message : String(e)})`);
  }
  cache.set(c, { at: Date.now(), ok: value !== null, value });
  return value;
}

// The latest release of c: from the cache, else asked now. With wait false
// a missing or old entry is refreshed in the background and the old one
// (or null) returned at once.
function latest(c: Component, wait: boolean): Promise<Release | null> | Release | null {
  const hit = cache.get(c);
  if (hit && Date.now() - hit.at < (hit.ok ? TTL : RETRY)) return hit.value;
  let p = inflight.get(c);
  if (!p) {
    p = fetchLatest(c).finally(() => inflight.delete(c));
    inflight.set(c, p);
  }
  return wait ? p : (hit?.value ?? null);
}

async function options(): Promise<{ enabled: boolean; collector: string | null }> {
  try {
    const rows = await adminQuery<{ keyname: string; value: string }>(
      `SELECT keyname, value FROM hlstats_Options WHERE keyname IN (?)`,
      [["gamewe_update_check", "gamewe_collector_version"]],
    );
    const o = Object.fromEntries(rows.map((r) => [r.keyname, r.value]));
    return { enabled: (o.gamewe_update_check ?? "1").trim() !== "0", collector: o.gamewe_collector_version?.trim() || null };
  } catch {
    return { enabled: false, collector: null };
  }
}

// The components with a newer release, the collector's version as it
// reported it (null: a collector before 0.17 or none), and whether the last
// question to GitHub failed. wait: ask GitHub now when nothing is cached
// (the overview page, at most WAIT ms); otherwise only cached answers (the
// frame of every other admin page).
export async function updateStatus(wait = false): Promise<{ updates: Update[]; collector: string | null; failed: boolean }> {
  const o = await options();
  if (!o.enabled) return { updates: [], collector: o.collector, failed: false };
  const running: Record<Component, string | null> = { web: process.env.APP_VERSION ?? null, collector: o.collector };
  const out: Update[] = [];
  let failed = false;
  for (const c of Object.keys(REPOS) as Component[]) {
    const current = running[c];
    if (!parseVersion(current)) continue; // dev build, or a collector that does not report its version
    const rel = await latest(c, wait);
    if (cache.get(c)?.ok === false) failed = true;
    if (rel && isNewer(rel.version, current)) out.push({ component: c, current: current!, latest: rel.version, url: rel.url });
  }
  return { updates: out, collector: o.collector, failed };
}
