// Fetches one map from a game server's FastDL and draws its radar picture.
// The site starts this as a process of its own (src/lib/overview-fastdl.ts):
// the map comes from the network, so it runs without the site's environment,
// with a time limit, and cannot stall the pages.
//
//   node scripts/overviews/build/fastdl.js <base url> <map> <out folder>
import { lookup } from "node:dns";
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import path from "node:path";
import { Readable } from "node:stream";
import { Bsp } from "./bsp.ts";
import { bunzip2 } from "./bzip2.ts";
import { render } from "./render.ts";

// The same rule as MAP_NAME in src/lib/overview-format.ts (tests compare them).
export const MAP_NAME = /^[a-z0-9][a-z0-9_.+-]{0,63}$/;
export const MAX_DOWNLOAD = 512 * 1024 * 1024;
export const MAX_MAP = 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

type Get = (url: string) => Promise<Response>;

// The site's own network is off limits: the address is an admin setting, but a
// visitor's page view starts the request, and a name may resolve to anything.
// 6to4 (2002::/16) and Teredo (2001::/32) tunnel to an IPv4 address that the list
// cannot see.
const PRIVATE = new BlockList();
for (const [net, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["224.0.0.0", 4], ["240.0.0.0", 4]] as const) PRIVATE.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [["::", 128], ["::1", 128], ["64:ff9b::", 96], ["2001::", 32], ["2002::", 16], ["fc00::", 7], ["fe80::", 10], ["ff00::", 8]] as const) PRIVATE.addSubnet(net, bits, "ipv6");

/** An address of this host, its network or no real destination; IPv4 in IPv6 counts as IPv4. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  return family === 0 || PRIVATE.check(ip, family === 6 ? "ipv6" : "ipv4");
}

// Checked at connect time, so a name cannot change between check and use.
const publicLookup: LookupFunction = (host, options, done) => {
  lookup(host, { ...options, all: true }, (err, found) => {
    const bad = err ?? (found.some((a) => isPrivateAddress(a.address)) ? new Error(`${host} is a private address`) : null);
    if (bad) done(bad as NodeJS.ErrnoException, options.all ? [] : "", 0);
    else if (options.all) done(null, found);
    else done(null, found[0].address, found[0].family);
  });
};

/** A GET without redirects that reaches public addresses only, unless allowed. */
export function guardedGet(allowPrivate: boolean, timeoutMs = DOWNLOAD_TIMEOUT_MS, headers: Record<string, string> = {}): Get {
  return (url) =>
    new Promise((resolve, reject) => {
      const u = new URL(url);
      const literal = u.hostname.replace(/^\[|\]$/g, "");
      if (!allowPrivate && isIP(literal) && isPrivateAddress(literal)) return reject(new Error(`${literal} is a private address`));
      const req = (u.protocol === "https:" ? https : http).get(u, { headers, lookup: allowPrivate ? undefined : publicLookup, signal: AbortSignal.timeout(timeoutMs) }, (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400) {
          res.destroy();
          return reject(new Error(`redirect (HTTP ${status})`));
        }
        const headers = new Headers();
        if (res.headers["content-length"]) headers.set("content-length", res.headers["content-length"]);
        const empty = status === 204 || status === 205;
        if (empty) res.resume();
        resolve(new Response(empty ? null : (Readable.toWeb(res) as ReadableStream), { status, headers }));
      });
      req.on("error", reject);
    });
}

/** The body, stopping as soon as it is larger than the limit. */
export async function readLimited(res: Response, max: number): Promise<Buffer> {
  if (Number(res.headers.get("content-length") ?? 0) > max) throw new Error(`larger than ${max} bytes`);
  const parts: Uint8Array[] = [];
  let size = 0;
  if (!res.body) return Buffer.alloc(0);
  for await (const part of res.body) {
    size += part.length;
    if (size > max) throw new Error(`larger than ${max} bytes`);
    parts.push(part);
  }
  return Buffer.concat(parts);
}

/** <base>maps/<map>.bsp.bz2, then <base>maps/<map>.bsp, as game clients ask. */
export async function downloadMap(base: string, map: string, fetchUrl: Get = guardedGet(false), maxDownload = MAX_DOWNLOAD, maxMap = MAX_MAP): Promise<Buffer> {
  if (!MAP_NAME.test(map)) throw new Error("bad map name");
  const u = new URL(base);
  if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password) throw new Error("bad FastDL address");
  const url = (file: string) => new URL(`maps/${encodeURIComponent(file)}`, u.href.endsWith("/") ? u : `${u.href}/`).href;
  const bz2 = await fetchUrl(url(`${map}.bsp.bz2`));
  if (bz2.ok) return bunzip2(await readLimited(bz2, maxDownload), maxMap);
  await bz2.body?.cancel();
  const bsp = await fetchUrl(url(`${map}.bsp`));
  if (!bsp.ok) throw new Error(`HTTP ${bz2.status} for the .bsp.bz2, ${bsp.status} for the .bsp`);
  return readLimited(bsp, Math.min(maxDownload, maxMap));
}

/** Draws <dir>/<map>.png and .json; both appear only when both are done, and
 *  a picture that is already there stays. */
export async function fetchOverview(base: string, map: string, dir: string, fetchUrl: Get = guardedGet(false)): Promise<void> {
  if (!MAP_NAME.test(map)) throw new Error("bad map name");
  const png = path.join(dir, `${map}.png`);
  const json = path.join(dir, `${map}.json`);
  if (existsSync(png)) return;
  const bsp = new Bsp(await downloadMap(base, map, fetchUrl));
  mkdirSync(dir, { recursive: true });
  // a leading dot: the overview index does not take these for pictures
  const tmp = path.join(dir, `.fastdl-${process.pid}`);
  try {
    render(bsp, "-", `${tmp}.png`, `${tmp}.json`);
    renameSync(`${tmp}.json`, json);
    renameSync(`${tmp}.png`, png);
  } finally {
    rmSync(`${tmp}.png`, { force: true });
    rmSync(`${tmp}.json`, { force: true });
  }
}

if (require.main === module) {
  const [base, map, dir] = process.argv.slice(2);
  // FASTDL_HEADERS: what the site set (User-Agent, Referer, Authorization, one
  // more), as a JSON object; never written to the output.
  let headers: Record<string, string> = {};
  try {
    const h: unknown = JSON.parse(process.env.FASTDL_HEADERS || "{}");
    if (h && typeof h === "object" && Object.values(h).every((v) => typeof v === "string")) headers = h as Record<string, string>;
  } catch {
    // none
  }
  fetchOverview(base, map, dir, guardedGet(process.env.FASTDL_ALLOW_PRIVATE === "1", undefined, headers)).catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
}
