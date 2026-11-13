import "server-only";
import { lstat, readFile } from "node:fs/promises";
import path from "node:path";
import { OWN_MAP_IMAGES } from "./content-dirs";
import { mapImageNames } from "./overview-format";

// The map picture of the banners (a thumbnail of the map, not the radar
// picture of the heatmap): yours from /var/lib/gamewe/web/map-images, else
// the built-in one from map-images/ next to the server (<game>/<map>.png|webp|jpg,
// the ranking's code before the base game). Made small
// (THUMB_W x THUMB_H, cut to fill) as a PNG data URL; null without one, then
// the banner shows its "no map picture" box.
export const THUMB_W = 248;
export const THUMB_H = 92;
const MAX_IMAGE = 8 * 1024 * 1024;

const thumbs = new Map<string, string | null>();

export async function mapThumb(code: string, realgame: string | null | undefined, map: string): Promise<string | null> {
  const src = await ownFile(code, realgame, map);
  if (!src) return null;
  const key = `${src.file}:${src.mtime}`;
  if (thumbs.has(key)) return thumbs.get(key) ?? null;
  const value = await thumb(src.file);
  if (thumbs.size > 300) thumbs.clear();
  thumbs.set(key, value);
  return value;
}

// Only plain files (lstat: no symlinks) up to MAX_IMAGE; your folder first.
async function ownFile(code: string, realgame: string | null | undefined, map: string) {
  for (const root of [OWN_MAP_IMAGES, path.join(process.cwd(), "map-images")]) {
    for (const rel of mapImageNames(code, realgame, map) ?? []) {
      const file = path.join(root, rel);
      const st = await lstat(file).catch(() => null);
      if (st?.isFile() && st.size > 0 && st.size <= MAX_IMAGE) return { file, mtime: Math.floor(st.mtimeMs) };
    }
  }
  return null;
}

async function thumb(file: string): Promise<string | null> {
  try {
    // sharp comes with Next.js (its picture optimisation), also in the standalone build.
    const sharp = (await import("sharp")).default;
    const png = await sharp(await readFile(file), { limitInputPixels: 50_000_000 })
      .resize(THUMB_W, THUMB_H, { fit: "cover" })
      .png({ palette: true })
      .toBuffer();
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch (e) {
    console.warn(`map picture ${path.basename(file)}: ${(e as Error).message}`);
    return null;
  }
}
