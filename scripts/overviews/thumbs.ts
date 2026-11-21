// Map thumbnails for the banners from a Source game's own files: the menu
// pictures materials/vgui/maps/menu_thumb_<map>.vtf (Left 4 Dead 1 and 2:
// materials/vgui/maps/<map>.vtf, taken only for a map of the game, there
// are campaign and background pictures beside them; CS:GO: the screenshots
// materials/panorama/images/map_icons/screenshots/360p/<map>.png, also only
// for a map of the game; CS2: the same screenshots as the PNG inside
// panorama/images/map_icons/screenshots/360p/<map>_png.vtex_c, for a map
// maps/<map>.vpk), from the game's VPK archives and loose files,
// at most 256 pixels wide as <out>/<game>/<map>.webp for the website's
// map-images folder (src/lib/map-images.ts), made from the operator's own
// game installation; the built-in map-images/css came from it. See README.md.
//
//   npm run map-thumbs -- <game folder, e.g. .../Counter-Strike Source/cstrike> <game code, e.g. css> [<out folder>]
//
// Several game folders (Left 4 Dead 2: left4dead2, its DLC folders and
// update) go in one argument, separated by the path list separator
// (":" on Linux, ";" on Windows); a later folder wins.
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, readSync, readdirSync } from "node:fs";
import path from "node:path";
import { encodePng } from "./draw.ts";

const THUMB = /^materials\/vgui\/maps\/(menu_thumb_)?([a-z0-9][a-z0-9_.+-]{0,63})\.vtf$/;
const BSP = /^maps\/([a-z0-9][a-z0-9_.+-]{0,63})\.(?:bsp|vpk)$/;
// Finished pictures: CS:GO/CS2 screenshots, Day of Defeat's manual pictures (JPEG).
// Condition Zero's wide map thumbnails (TGA) count as such too.
const CZ_THUMB = /^gfx\/thumbnails\/maps_wide\/([a-z0-9][a-z0-9_.+-]{0,63})\.tga$/;
const SHOT = /^(?:(?:materials\/)?panorama\/images\/map_icons\/screenshots\/360p\/([a-z0-9][a-z0-9_.+-]{0,63}?)(?:\.png|_png\.vtex_c)|manual\/manual_images\/map_images\/([a-z0-9][a-z0-9_.+-]{0,63})\.jpg)$/;
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
// Maps whose picture has another name: Left 4 Dead 2's ports of the Left 4
// Dead campaigns The Sacrifice (c7) and No Mercy (c8) ship only those of the
// original maps; TF2's Hoodoo is pl_hoodoo_final, its picture pl_hoodoo.
const SAME_MAP: Record<string, string> = {
  pl_hoodoo_final: "pl_hoodoo",
  dod_charlie: "dod_charlie1", // Day of Defeat's manual has two pictures of it
  c7m1_docks: "l4d_river01_docks",
  c7m2_barge: "l4d_river02_barge",
  c7m3_port: "l4d_river03_port",
  c8m1_apartment: "l4d_hospital01_apartment",
  c8m2_subway: "l4d_hospital02_subway",
  c8m3_sewers: "l4d_hospital03_sewers",
  c8m4_interior: "l4d_hospital04_interior",
  c8m5_rooftop: "l4d_hospital05_rooftop",
};
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
const PLAIN: Record<number, [number, number[]]> = { 0: [4, [0, 1, 2, 3]], 1: [4, [3, 2, 1, 0]], 2: [3, [0, 1, 2]], 3: [3, [2, 1, 0]], 12: [4, [2, 1, 0, 3]] };
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

/** Height without the empty filler rows at the bottom (one colour or transparent): CS:S
 * keeps its 128x96 pictures in a 128x128 texture. */
export function contentHeight(rgba: Uint8Array, width: number, height: number): number {
  // The filler is one colour (TF2: white, grey or black, the first row of it
  // a little off-white): a row is empty when every pixel is transparent or
  // close to the bottom row's first pixel.
  const ref = (height - 1) * width * 4;
  const near = (p: number) => Math.abs(rgba[p] - rgba[ref]) <= 24 && Math.abs(rgba[p + 1] - rgba[ref + 1]) <= 24 && Math.abs(rgba[p + 2] - rgba[ref + 2]) <= 24;
  const empty = (y: number) => {
    for (let x = 0; x < width; x++) {
      const p = (y * width + x) * 4;
      if (rgba[p + 3] !== 0 && !near(p)) return false;
    }
    return true;
  };
  let h = height;
  while (h > 1 && empty(h - 1)) h--;
  return h;
}

/** The pictures of the maps of game folders (maps/<map>.bsp or .vpk): the
 * CS:GO/CS2 screenshot (PNG), else menu_thumb_<map>.vtf, else <map>.vtf,
 * else that of SAME_MAP. VPK archives first, loose files win, a later folder
 * wins. Pictures without a map of the folders (removed maps, "missing") are
 * left out. */
export function findThumbs(gameDirs: string[]): Map<string, Buffer> {
  const thumbs = new Map<string, Buffer>();
  const plain = new Map<string, Buffer>();
  const shots = new Map<string, Buffer>();
  const maps = new Set<string>();
  const add = (file: string, body: () => Buffer) => {
    const bsp = BSP.exec(file);
    if (bsp) maps.add(bsp[1]);
    const shot = SHOT.exec(file);
    if (shot) shots.set(shot[1] ?? shot[2], file.endsWith(".vtex_c") ? pngInside(body()) : body());
    const cz = CZ_THUMB.exec(file);
    if (cz) {
      try {
        const { width, height, rgba } = decodeTga(body());
        shots.set(cz[1], encodePng(rgba, width, height));
      } catch (e) {
        console.error(`${cz[1]}: ${(e as Error).message}`); // one bad picture does not stop the others
      }
    }
    const m = THUMB.exec(file);
    if (m && !m[2].startsWith("default")) (m[1] ? thumbs : plain).set(m[2], body());
  };
  for (const gameDir of gameDirs) {
    for (const f of readdirSync(gameDir).filter((n) => n.endsWith("_dir.vpk")).sort()) {
      const raw = readFileSync(path.join(gameDir, f));
      const { entries, dataStart } = readVpkDir(raw);
      for (const [file, e] of entries) {
        add(file, () =>
          Buffer.concat([
            e.preload,
            e.archive === 0x7fff
              ? raw.subarray(dataStart + e.offset, dataStart + e.offset + e.length)
              : readPart(path.join(gameDir, `${f.slice(0, -"_dir.vpk".length)}_${String(e.archive).padStart(3, "0")}.vpk`), e.offset, e.length),
          ]),
        );
      }
    }
    for (const sub of ["maps", path.join("materials", "vgui", "maps"), path.join("materials", "panorama", "images", "map_icons", "screenshots", "360p"), path.join("panorama", "images", "map_icons", "screenshots", "360p"), path.join("manual", "manual_images", "map_images"), path.join("gfx", "thumbnails", "maps_wide")]) {
      const dir = path.join(gameDir, sub);
      if (!existsSync(dir)) continue;
      for (const n of readdirSync(dir)) add(`${sub.split(path.sep).join("/")}/${n.toLowerCase()}`, () => readFileSync(path.join(dir, n)));
    }
  }
  const out = new Map<string, Buffer>();
  for (const map of maps) {
    // Left 4 Dead's versus maps (l4d_vs_<map>) are the campaign maps.
    const same = SAME_MAP[map] ?? (map.startsWith("l4d_vs_") ? `l4d_${map.slice("l4d_vs_".length)}` : "");
    // CS 1.6 has no pictures: with Condition Zero's folder given too, a map
    // takes the picture of its Condition Zero version <map>_cz.
    const pic = [shots.get(map), thumbs.get(map), plain.get(map), shots.get(same), thumbs.get(same), plain.get(same), shots.get(`${map}_cz`)].find((b) => b?.length);
    if (pic) out.set(map, pic);
  }
  return out;
}

/** An uncompressed true-colour TGA (type 2, 24 or 32 bit) as RGBA. */
export function decodeTga(tga: Buffer): { width: number; height: number; rgba: Uint8Array } {
  const [idLength, , type] = tga;
  const width = tga.readUInt16LE(12);
  const height = tga.readUInt16LE(14);
  const bytes = tga[16] / 8;
  if (type !== 2 || (bytes !== 3 && bytes !== 4)) throw new Error(`TGA type ${type}, ${tga[16]} bit`);
  if (!width || !height || width > 4096 || height > 4096) throw new Error(`size ${width}x${height}`);
  const start = 18 + idLength;
  if (tga.length < start + width * height * bytes) throw new Error("TGA cut off");
  const topDown = (tga[17] & 0x20) !== 0;
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = start + (topDown ? y : height - 1 - y) * width * bytes;
    for (let x = 0; x < width; x++) {
      const p = row + x * bytes;
      const o = (y * width + x) * 4;
      rgba[o] = tga[p + 2];
      rgba[o + 1] = tga[p + 1];
      rgba[o + 2] = tga[p];
      rgba[o + 3] = bytes === 4 ? tga[p + 3] : 255;
    }
  }
  return { width, height, rgba };
}

/** The PNG a Source 2 texture (.vtex_c) of a panorama image carries, up to its
 * IEND chunk; empty when there is none. */
export function pngInside(vtex: Buffer): Buffer {
  const start = vtex.indexOf(PNG);
  const end = vtex.indexOf("IEND", start);
  return start < 0 || end < 0 ? Buffer.alloc(0) : vtex.subarray(start, end + 8);
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

async function main() {
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
  for (const [map, vtf] of findThumbs(gameDir.split(path.delimiter).filter(Boolean))) {
    // WebP: as a PNG a picture is about four times the size (ten for a photo).
    const out = path.join(outDir, `${map}.webp`);
    // Pictures already there (your own) stay.
    if (["png", "webp", "jpg", "jpeg"].some((ext) => existsSync(path.join(outDir, `${map}.${ext}`)))) {
      console.log(`${map}: kept, a picture is there`);
      continue;
    }
    try {
      const sharp = (await import("sharp")).default;
      let img;
      if (vtf.toString("latin1", 0, 4) !== "VTF\0") {
        img = sharp(vtf, { limitInputPixels: 50_000_000 });
      } else {
        const { width, height, rgba } = decodeVtf(vtf);
        const h = contentHeight(rgba, width, height);
        img = sharp(rgba.subarray(0, width * h * 4), { raw: { width, height: h, channels: 4 } });
      }
      // The banner's box is 248x92, so 256 wide is plenty (CS:GO's screenshots are 640x360).
      const info = await img.resize({ width: 256, withoutEnlargement: true }).webp({ quality: 80 }).toFile(out);
      made++;
      console.log(`${map}: ${out} (${info.width}x${info.height})`);
    } catch (e) {
      console.error(`${map}: ${(e as Error).message}`);
    }
  }
  console.log(`${made} thumbnails written to ${outDir}`);
}

if (process.argv[1] && path.basename(process.argv[1]).startsWith("thumbs.")) void main();
