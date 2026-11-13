// Map thumbnails for the banners from a Source game's own files: the menu
// pictures materials/vgui/maps/menu_thumb_<map>.vtf, from the game's VPK
// archives and loose files, as <out>/<game>/<map>.png for the website's
// map-images folder (src/lib/map-images.ts). Each operator makes them from
// their own game installation; gameWE ships none of them. See README.md.
//
//   npm run map-thumbs -- <game folder, e.g. .../Counter-Strike Source/cstrike> <game code, e.g. css> [<out folder>]
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { encodePng } from "./draw.ts";

const THUMB = /^materials\/vgui\/maps\/menu_thumb_([a-z0-9][a-z0-9_.+-]{0,63})\.vtf$/;
const GAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;

export type VpkEntry = { archive: number; offset: number; length: number; preload: Buffer };

/** The file list of a VPK directory file (<name>_dir.vpk), versions 1 and 2; keys in lower case. */
export function readVpkDir(dir: Buffer): { entries: Map<string, VpkEntry>; dataStart: number } {
  if (dir.readUInt32LE(0) !== 0x55aa1234) throw new Error("not a VPK directory file");
  const version = dir.readUInt32LE(4);
  const treeSize = dir.readUInt32LE(8);
  const head = version === 1 ? 12 : version === 2 ? 28 : 0;
  if (!head) throw new Error(`VPK version ${version}`);
  let o = head;
  const str = () => {
    const end = dir.indexOf(0, o);
    if (end < 0) throw new Error("VPK tree cut off");
    const s = dir.toString("latin1", o, end);
    o = end + 1;
    return s;
  };
  const entries = new Map<string, VpkEntry>();
  for (let ext = str(); ext; ext = str()) {
    for (let folder = str(); folder; folder = str()) {
      for (let name = str(); name; name = str()) {
        const preloadBytes = dir.readUInt16LE(o + 4);
        const archive = dir.readUInt16LE(o + 6);
        const offset = dir.readUInt32LE(o + 8);
        const length = dir.readUInt32LE(o + 12);
        const preload = dir.subarray(o + 18, o + 18 + preloadBytes);
        o += 18 + preloadBytes;
        const file = `${folder === " " ? "" : `${folder}/`}${name}${ext === " " ? "" : `.${ext}`}`.toLowerCase();
        entries.set(file, { archive, offset, length, preload });
      }
    }
  }
  return { entries, dataStart: head + treeSize };
}

function dxtColors(c0: number, c1: number, four: boolean): number[][] {
  const rgb = (c: number) => [((c >> 11) & 31) * 255 / 31, ((c >> 5) & 63) * 255 / 63, (c & 31) * 255 / 31].map(Math.round);
  const a = rgb(c0);
  const b = rgb(c1);
  const mix = (x: number, y: number, n: number, d: number) => a.map((_, i) => Math.round((x === 0 ? a : b)[i] * (d - n) / d + (y === 0 ? a : b)[i] * n / d));
  return four || c0 > c1 ? [[...a, 255], [...b, 255], [...mix(0, 1, 1, 3), 255], [...mix(0, 1, 2, 3), 255]] : [[...a, 255], [...b, 255], [...mix(0, 1, 1, 2), 255], [0, 0, 0, 0]];
}

/** DXT1, DXT3 or DXT5 blocks to RGBA. */
export function decodeDxt(data: Buffer, w: number, h: number, kind: 1 | 3 | 5): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  const size = kind === 1 ? 8 : 16;
  let o = 0;
  for (let by = 0; by < h; by += 4) {
    for (let bx = 0; bx < w; bx += 4, o += size) {
      const c = o + size - 8;
      const colors = dxtColors(data.readUInt16LE(c), data.readUInt16LE(c + 2), kind !== 1);
      const bits = data.readUInt32LE(c + 4);
      const alpha = new Array<number>(16).fill(255);
      if (kind === 3) for (let i = 0; i < 16; i++) alpha[i] = ((data[o + (i >> 1)] >> ((i & 1) * 4)) & 15) * 17;
      if (kind === 5) {
        const [a0, a1] = [data[o], data[o + 1]];
        const table = a0 > a1 ? [a0, a1, ...[1, 2, 3, 4, 5, 6].map((n) => Math.round((a0 * (7 - n) + a1 * n) / 7))] : [a0, a1, ...[1, 2, 3, 4].map((n) => Math.round((a0 * (5 - n) + a1 * n) / 5)), 0, 255];
        const idx = data.readUIntLE(o + 2, 6);
        for (let i = 0; i < 16; i++) alpha[i] = table[Math.floor(idx / 2 ** (3 * i)) & 7];
      }
      for (let i = 0; i < 16; i++) {
        const x = bx + (i & 3);
        const y = by + (i >> 2);
        if (x >= w || y >= h) continue;
        const px = colors[(bits >>> (2 * i)) & 3];
        const p = (y * w + x) * 4;
        out.set([px[0], px[1], px[2], kind === 1 ? px[3] : alpha[i]], p);
      }
    }
  }
  return out;
}

// VTF picture formats: bytes per pixel and channel order of the plain ones.
const PLAIN: Record<number, [number, number[]]> = { 0: [4, [0, 1, 2, 3]], 2: [3, [0, 1, 2]], 3: [3, [2, 1, 0]], 12: [4, [2, 1, 0, 3]] };
const DXT: Record<number, 1 | 3 | 5> = { 13: 1, 14: 3, 15: 5 };

/** The largest picture of a VTF texture (the last one in the file) as RGBA. */
export function decodeVtf(vtf: Buffer): { width: number; height: number; rgba: Uint8Array } {
  if (vtf.toString("latin1", 0, 4) !== "VTF\0") throw new Error("not a VTF texture");
  const width = vtf.readUInt16LE(16);
  const height = vtf.readUInt16LE(18);
  const format = vtf.readInt32LE(52);
  if (!width || !height || width > 4096 || height > 4096) throw new Error(`size ${width}x${height}`);
  const dxt = DXT[format];
  const plain = PLAIN[format];
  if (!dxt && !plain) throw new Error(`picture format ${format}`);
  const bytes = dxt ? Math.ceil(width / 4) * Math.ceil(height / 4) * (dxt === 1 ? 8 : 16) : width * height * plain[0];
  if (bytes > vtf.length - 64) throw new Error("VTF cut off");
  const data = vtf.subarray(vtf.length - bytes);
  if (dxt) return { width, height, rgba: decodeDxt(data, width, height, dxt) };
  const [n, order] = plain;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    for (let c = 0; c < 3; c++) rgba[i * 4 + c] = data[i * n + order[c]];
    rgba[i * 4 + 3] = n === 4 ? data[i * n + order[3]] : 255;
  }
  return { width, height, rgba };
}

/** Height without the empty rows at the bottom (white or transparent): CS:S
 * keeps its 128x96 pictures in a 128x128 texture. */
export function contentHeight(rgba: Uint8Array, width: number, height: number): number {
  const empty = (y: number) => {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (rgba[p + 3] !== 0 && (rgba[p] < 250 || rgba[p + 1] < 250 || rgba[p + 2] < 250)) return false;
    }
    return true;
  };
  let h = height;
  while (h > 1 && empty(h - 1)) h--;
  return h;
}

/** All menu_thumb_<map>.vtf of a game folder: VPK archives first, loose files win. */
export function findThumbs(gameDir: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  for (const f of readdirSync(gameDir).filter((n) => n.endsWith("_dir.vpk")).sort()) {
    const dirFile = path.join(gameDir, f);
    const raw = readFileSync(dirFile);
    const { entries, dataStart } = readVpkDir(raw);
    for (const [file, e] of entries) {
      const m = THUMB.exec(file);
      if (!m || m[1].startsWith("default")) continue;
      const body =
        e.archive === 0x7fff
          ? raw.subarray(dataStart + e.offset, dataStart + e.offset + e.length)
          : readPart(path.join(gameDir, `${f.slice(0, -"_dir.vpk".length)}_${String(e.archive).padStart(3, "0")}.vpk`), e.offset, e.length);
      out.set(m[1], Buffer.concat([e.preload, body]));
    }
  }
  const loose = path.join(gameDir, "materials", "vgui", "maps");
  if (existsSync(loose)) {
    for (const n of readdirSync(loose)) {
      const m = THUMB.exec(`materials/vgui/maps/${n.toLowerCase()}`);
      if (m && !m[1].startsWith("default")) out.set(m[1], readFileSync(path.join(loose, n)));
    }
  }
  return out;
}

// Only the entry's bytes: the archives are hundreds of MB.
function readPart(file: string, offset: number, length: number): Buffer {
  const fd = openSync(file, "r");
  try {
    const buf = Buffer.alloc(length);
    const n = readSync(fd, buf, 0, length, offset);
    return buf.subarray(0, n);
  } finally {
    closeSync(fd);
  }
}

function main() {
  const [gameDir, game, outRoot = "/var/lib/gamewe/web/map-images"] = process.argv.slice(2);
  if (!gameDir || !game) {
    console.error("usage: npm run map-thumbs -- <game folder, e.g. .../cstrike> <game code, e.g. css> [<out folder>]");
    process.exit(1);
  }
  if (!GAME.test(game)) {
    console.error(`not a game code: ${game}`);
    process.exit(1);
  }
  const outDir = path.join(outRoot, game);
  mkdirSync(outDir, { recursive: true });
  let made = 0;
  for (const [map, vtf] of findThumbs(gameDir)) {
    const out = path.join(outDir, `${map}.png`);
    // Pictures already there (your own) stay.
    if (existsSync(out)) {
      console.log(`${map}: kept ${out}`);
      continue;
    }
    try {
      const { width, height, rgba } = decodeVtf(vtf);
      const h = contentHeight(rgba, width, height);
      writeFileSync(out, encodePng(rgba.subarray(0, width * h * 4), width, h));
      made++;
      console.log(`${map}: ${out} (${width}x${h})`);
    } catch (e) {
      console.error(`${map}: ${(e as Error).message}`);
    }
  }
  console.log(`${made} thumbnails written to ${outDir}`);
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("thumbs.")) main();
