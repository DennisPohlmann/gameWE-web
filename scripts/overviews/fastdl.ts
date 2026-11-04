// Fetches one map from a game server's FastDL and draws its radar picture.
// The site starts this as a process of its own (src/lib/overview-fastdl.ts):
// the map comes from the network, so it runs without the site's environment,
// with a time limit, and cannot stall the pages.
//
//   node scripts/overviews/build/fastdl.js <base url> <map> <out folder>
import { existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { Bsp } from "./bsp.ts";
import { bunzip2 } from "./bzip2.ts";
import { render } from "./render.ts";

// The same rule as MAP_NAME in src/lib/overview-format.ts (tests compare them).
export const MAP_NAME = /^[a-z0-9][a-z0-9_.+-]{0,63}$/;
export const MAX_DOWNLOAD = 512 * 1024 * 1024;
export const MAX_MAP = 1024 * 1024 * 1024;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

type Get = (url: string) => Promise<Response>;

const get: Get = (url) => fetch(url, { redirect: "error", signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });

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
export async function downloadMap(base: string, map: string, fetchUrl: Get = get, maxDownload = MAX_DOWNLOAD, maxMap = MAX_MAP): Promise<Buffer> {
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
export async function fetchOverview(base: string, map: string, dir: string, fetchUrl?: Get): Promise<void> {
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
  fetchOverview(base, map, dir).catch((e: Error) => {
    console.error(e.message);
    process.exit(1);
  });
}
