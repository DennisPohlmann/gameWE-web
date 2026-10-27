import "server-only";
import { lstat, open, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { basePath } from "./base-path";
import { env } from "./env";
import { type Calibration, type Frame, type ImageInfo, MAP_NAME, imageInfo, overviewFile, overviewFrame, parseCalibration } from "./overview-format";

// Map overviews (radar pictures) under the heatmap, like the templates: the
// built-in folder overviews/ next to the server, OVERVIEWS_DIR adds a folder
// of your own (the same file name: yours wins). In each, one subfolder per
// game (the game code or the base game, e.g. cs2, css) and files for every
// game directly in the folder; the game's subfolder is asked first. Picture
// and calibration are looked up separately, so a picture of your own uses
// the built-in calibration. Only plain files and folders with short
// [a-z0-9_.+-] names, no symlinks; the URLs name an entry of this index,
// never a path. See overviews/README.md.

const DIR = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const MAX_IMAGE = 8 * 1024 * 1024;
const MAX_TEXT = 64 * 1024;
// "_": the files directly in the folder (for every game).
const ALL = "_";

type Entry = { file: string; kind: "image" | "lower" | "json" | "txt"; rank: number; size: number; mtime: number };

// Key: "<dir>/<map>/<kind>".
let cache: { at: number; index: Map<string, Entry> } | undefined;

function roots(): string[] {
  const own = env("OVERVIEWS_DIR");
  return [path.join(process.cwd(), "overviews"), ...(own ? [path.resolve(own)] : [])];
}

async function scanDir(dir: string, key: string, into: Map<string, Entry>) {
  let names;
  try {
    names = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  // Within one folder the best rank wins; a later root replaces the earlier
  // one per map and kind.
  const here = new Map<string, Entry>();
  for (const d of names) {
    if (!d.isFile()) continue;
    const f = overviewFile(d.name);
    if (!f) continue;
    const file = path.join(dir, d.name);
    const st = await lstat(file).catch(() => null);
    const max = f.kind === "json" || f.kind === "txt" ? MAX_TEXT : MAX_IMAGE;
    if (!st?.isFile() || st.size > max || st.size < 1) continue;
    // json and txt: one calibration, json first.
    const kind = f.kind === "txt" ? "json" : f.kind;
    const k = `${key}/${f.map}/${kind}`;
    const rank = f.kind === "txt" ? 1 : f.rank;
    const prev = here.get(k);
    if (!prev || rank < prev.rank) here.set(k, { file, kind: f.kind, rank, size: st.size, mtime: Math.floor(st.mtimeMs) });
  }
  for (const [k, e] of here) into.set(k, e);
}

async function index(): Promise<Map<string, Entry>> {
  if (cache && Date.now() - cache.at < 60_000) return cache.index;
  const out = new Map<string, Entry>();
  for (const root of roots()) {
    await scanDir(root, ALL, out);
    let subs;
    try {
      subs = (await readdir(root, { withFileTypes: true })).filter((d) => d.isDirectory() && DIR.test(d.name));
    } catch {
      continue;
    }
    for (const d of subs) await scanDir(path.join(root, d.name), d.name, out);
  }
  cache = { at: Date.now(), index: out };
  return out;
}

async function readHead(file: string, n: number): Promise<Uint8Array | null> {
  const st = await lstat(file).catch(() => null);
  if (!st?.isFile()) return null;
  const fh = await open(file, "r").catch(() => null);
  if (!fh) return null;
  try {
    const buf = new Uint8Array(Math.min(n, st.size));
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

const calibrations = new Map<string, { mtime: number; value: Calibration | null }>();
const images = new Map<string, { mtime: number; value: ImageInfo | null }>();
const noted = new Set<string>();

function note(key: string, msg: string) {
  if (noted.has(key)) return;
  noted.add(key);
  console.warn(msg);
}

async function calibration(e: Entry, label: string): Promise<Calibration | null> {
  const hit = calibrations.get(e.file);
  if (hit && hit.mtime === e.mtime) return hit.value;
  const st = await lstat(e.file).catch(() => null);
  const text = st?.isFile() && st.size <= MAX_TEXT ? await readFile(e.file, "utf8").catch(() => null) : null;
  const value = text === null ? null : parseCalibration(text, e.kind === "txt" ? "txt" : "json");
  if (!value) note(`${e.file}:${e.mtime}`, `overview ${label}: calibration unreadable (needs pos_x, pos_y and scale)`);
  if (calibrations.size > 500) calibrations.clear();
  calibrations.set(e.file, { mtime: e.mtime, value });
  return value;
}

async function picture(e: Entry, label: string): Promise<ImageInfo | null> {
  const hit = images.get(e.file);
  if (hit && hit.mtime === e.mtime) return hit.value;
  const head = await readHead(e.file, 256 * 1024).catch(() => null);
  const value = head ? imageInfo(head) : null;
  if (!value) note(`${e.file}:${e.mtime}`, `overview ${label}: not a PNG, JPEG or WebP picture`);
  if (images.size > 500) images.clear();
  images.set(e.file, { mtime: e.mtime, value });
  return value;
}

export type Overview = {
  frame: Frame;
  // Picture URL, the lower level's where there is one.
  href: string;
  lowerHref: string | null;
  // Height where the lower level ends, from the calibration.
  lowerSplit: number | null;
  // The lower level drawn on the main picture (overview-format.ts).
  lowerShift: { x: number; y: number } | null;
};

// The overview of a map: game folders first (the game code, then the base
// game), then the common files. Null without a picture or a usable
// calibration.
export async function getOverview(code: string, realgame: string | null | undefined, map: string): Promise<Overview | null> {
  const name = map.trim().toLowerCase();
  if (!MAP_NAME.test(name)) return null;
  const dirs = [...new Set([code, realgame ?? ""].map((d) => d.trim().toLowerCase()).filter((d) => DIR.test(d))), ALL];
  const idx = await index();
  const find = (kind: string) => {
    for (const d of dirs) {
      const e = idx.get(`${d}/${name}/${kind}`);
      if (e) return { dir: d, e };
    }
    return null;
  };
  const img = find("image");
  const cal = find("json");
  if (!img || !cal) return null;
  const label = `${img.dir}/${name}`;
  const [c, info] = await Promise.all([calibration(cal.e, label), picture(img.e, label)]);
  if (!c || !info) return null;
  const low = find("lower");
  const lowInfo = low ? await picture(low.e, `${low.dir}/${name} (lower)`) : null;
  const url = (dir: string, kind: string, e: Entry) => `${basePath}/overview/${dir}/${name}${kind === "lower" ? ".lower" : ""}?v=${e.mtime}`;
  return {
    frame: overviewFrame(c, info),
    href: url(img.dir, "image", img.e),
    lowerHref: low && lowInfo ? url(low.dir, "lower", low.e) : null,
    lowerSplit: c.lowerSplit,
    lowerShift: c.lowerShift,
  };
}

// The picture behind /overview/<dir>/<map>[.lower]: bytes and type (from the
// content), or null.
export async function overviewImage(dir: string, file: string): Promise<{ body: Uint8Array; type: string } | null> {
  const m = /^(.+?)(\.lower)?$/.exec(file);
  if (!m || !(dir === ALL || DIR.test(dir)) || !MAP_NAME.test(m[1])) return null;
  const e = (await index()).get(`${dir}/${m[1]}/${m[2] ? "lower" : "image"}`);
  if (!e) return null;
  const st = await lstat(e.file).catch(() => null);
  if (!st?.isFile() || st.size > MAX_IMAGE) return null;
  const body = new Uint8Array(await readFile(e.file));
  const info = imageInfo(body);
  return info ? { body, type: info.type } : null;
}

// Noted once per picture: its calibration does not fit the dots.
export function noteMismatch(ov: Overview, map: string) {
  note(`mismatch:${ov.href}`, `overview ${map}: most positions lie outside the picture, check pos_x, pos_y and scale; shown without it`);
}
