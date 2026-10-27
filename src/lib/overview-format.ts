// Map overviews (radar pictures) under the heatmap: reading the calibration
// files and the picture sizes. No file access here (see overviews.ts), so the
// tests can use it.
//
// A calibration is Valve's HLTV overview description (resource/overviews/
// <map>.txt of CS:GO and CS2, KeyValues) or the same values as JSON:
// pos_x/pos_y are the game coordinates of the picture's upper left corner,
// scale the game units per pixel of a picture REF pixels wide (Valve's radar
// pictures are 1024 x 1024; a larger export covers the same area). A lower
// level (verticalsections.lower.AltitudeMax) gives the height where it ends.

export type Calibration = {
  posX: number;
  posY: number;
  scale: number;
  // Width in pixels the scale refers to (default REF).
  ref: number;
  // Height (pos_z) at which the lower level ends, from verticalsections.
  lowerSplit: number | null;
};

export const REF = 1024;

// Where the picture lies in the heatmap's frame (game units, x to the right,
// y up, so y is the upper edge).
export type Frame = { x: number; y: number; width: number; height: number };

type KV = { [key: string]: string | KV };

// Valve KeyValues: "key" "value" and "key" { ... }, // comments, keys case
// insensitive (stored in lower case). Only what an overview file needs; at
// most 64 KB and 8 levels, anything broken gives null.
export function parseKeyValues(text: string): KV | null {
  if (text.length > 65536) return null;
  const tokens: (string | "{" | "}")[] = [];
  const quoted: boolean[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
    } else if (c === "{" || c === "}") {
      tokens.push(c);
      quoted.push(false);
      i++;
    } else if (c === '"') {
      const end = text.indexOf('"', i + 1);
      if (end < 0) return null;
      tokens.push(text.slice(i + 1, end));
      quoted.push(true);
      i = end + 1;
    } else if (/\s/.test(c)) {
      i++;
    } else {
      let j = i;
      while (j < text.length && !/[\s{}"]/.test(text[j])) j++;
      tokens.push(text.slice(i, j));
      quoted.push(false);
      i = j;
    }
  }
  let p = 0;
  const block = (depth: number): KV | null => {
    if (depth > 8) return null;
    const out: KV = {};
    while (p < tokens.length) {
      if (tokens[p] === "}" && !quoted[p]) {
        p++;
        return out;
      }
      if (tokens[p] === "{" && !quoted[p]) return null;
      const key = tokens[p++].toLowerCase();
      if (p >= tokens.length) return null;
      if (tokens[p] === "{" && !quoted[p]) {
        p++;
        const sub = block(depth + 1);
        if (!sub) return null;
        if (!(key in out)) out[key] = sub;
      } else if (tokens[p] === "}" && !quoted[p]) {
        return null;
      } else {
        const v = tokens[p++];
        if (!(key in out)) out[key] = v;
      }
    }
    return depth === 0 ? out : null;
  };
  return block(0);
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

// The values of one overview: from the KeyValues block of the map (the only
// top-level block) or the JSON object. Scale must be positive; a lower split
// only from a "lower" vertical section.
function fromObject(o: Record<string, unknown>): Calibration | null {
  const low: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) low[k.toLowerCase()] = v;
  const posX = num(low.pos_x);
  const posY = num(low.pos_y);
  const scale = num(low.scale);
  if (posX === null || posY === null || scale === null || scale <= 0 || scale > 1000) return null;
  if (Math.abs(posX) > 1e6 || Math.abs(posY) > 1e6) return null;
  const ref = num(low.ref) ?? REF;
  if (ref < 16 || ref > 16384) return null;
  let lowerSplit: number | null = null;
  const vs = low.verticalsections;
  if (vs && typeof vs === "object") {
    const lower = Object.entries(vs as Record<string, unknown>).find(([k]) => k.toLowerCase() === "lower")?.[1];
    if (lower && typeof lower === "object") {
      const max = Object.entries(lower as Record<string, unknown>).find(([k]) => k.toLowerCase() === "altitudemax")?.[1];
      lowerSplit = num(max);
    }
  }
  if (lowerSplit === null) lowerSplit = num(low.lower_split);
  return { posX, posY, scale, ref, lowerSplit };
}

export function parseCalibration(text: string, kind: "json" | "txt"): Calibration | null {
  if (kind === "json") {
    try {
      const o = JSON.parse(text);
      return o && typeof o === "object" && !Array.isArray(o) ? fromObject(o) : null;
    } catch {
      return null;
    }
  }
  const kv = parseKeyValues(text);
  if (!kv) return null;
  const top = Object.values(kv).find((v) => typeof v === "object");
  return top && typeof top === "object" ? fromObject(top) : null;
}

export type ImageInfo = { type: "image/png" | "image/jpeg" | "image/webp"; width: number; height: number };

// Type and size of a PNG, JPEG or WebP from its first bytes (the type from
// the content, not the file name). Anything else gives null.
export function imageInfo(b: Uint8Array): ImageInfo | null {
  const u16be = (o: number) => (b[o] << 8) | b[o + 1];
  const u32be = (o: number) => ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
  const u24le = (o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);
  const ascii = (o: number, n: number) => String.fromCharCode(...b.subarray(o, o + n));
  const ok = (type: ImageInfo["type"], width: number, height: number) =>
    width > 0 && height > 0 && width <= 16384 && height <= 16384 ? { type, width, height } : null;
  if (b.length >= 24 && b[0] === 0x89 && ascii(1, 3) === "PNG" && ascii(12, 4) === "IHDR") return ok("image/png", u32be(16), u32be(20));
  if (b.length >= 30 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") {
    const chunk = ascii(12, 4);
    if (chunk === "VP8X") return ok("image/webp", u24le(24) + 1, u24le(27) + 1);
    if (chunk === "VP8L" && b[20] === 0x2f) {
      const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
      return ok("image/webp", (bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1);
    }
    if (chunk === "VP8 " && b[23] === 0x9d && b[24] === 0x01 && b[25] === 0x2a) return ok("image/webp", u16le(b, 26) & 0x3fff, u16le(b, 28) & 0x3fff);
    return null;
  }
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let o = 2;
    while (o + 9 < b.length) {
      if (b[o] !== 0xff) return null;
      const marker = b[o + 1];
      if (marker === 0xff) {
        o++;
        continue;
      }
      const len = u16be(o + 2);
      // SOF0-SOF15 without DHT (C4), JPG (C8) and DAC (CC).
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return ok("image/jpeg", u16be(o + 7), u16be(o + 5));
      if (len < 2) return null;
      o += 2 + len;
    }
  }
  return null;
}

function u16le(b: Uint8Array, o: number) {
  return b[o] | (b[o + 1] << 8);
}

// The picture in the heatmap's frame: REF pixels wide cover ref * scale game
// units, the height follows the picture's aspect.
export function overviewFrame(c: Calibration, img: { width: number; height: number }): Frame {
  const width = c.ref * c.scale;
  return { x: c.posX, y: c.posY, width, height: (width * img.height) / img.width };
}

// Share of the dots that lie on the picture; a calibration of another map
// version leaves most of them outside.
export function insideShare(frame: Frame, dots: [number, number, ...number[]][]): number {
  if (!dots.length) return 1;
  let n = 0;
  for (const [x, y] of dots) if (x >= frame.x && x <= frame.x + frame.width && y <= frame.y && y >= frame.y - frame.height) n++;
  return n / dots.length;
}

// File names in an overview folder: <map>.png|webp|jpg|jpeg, also Valve's
// <map>_radar(_psd).png, the lower level as <map>_lower(...); the
// calibration as <map>.json or <map>.txt. Map names in lower case.
export const MAP_NAME = /^[a-z0-9][a-z0-9_.+-]{0,63}$/;
const PICTURE = /^([a-z0-9][a-z0-9_.+-]{0,63}?)(_lower)?(?:_radar(?:_psd)?)?\.(png|webp|jpe?g)$/;
const CALIBRATION = /^([a-z0-9][a-z0-9_.+-]{0,63})\.(json|txt)$/;

export type OverviewFile = { map: string; kind: "image" | "lower" | "json" | "txt"; rank: number };

// What a file is for, or null. rank: the preferred one of several for the
// same map and kind (lower wins): plain name before _radar, png before webp
// before jpg; json before txt.
export function overviewFile(name: string): OverviewFile | null {
  const c = CALIBRATION.exec(name);
  if (c) return { map: c[1], kind: c[2] as "json" | "txt", rank: 0 };
  const p = PICTURE.exec(name);
  if (!p || !MAP_NAME.test(p[1])) return null;
  const ext = { png: 0, webp: 1, jpg: 2, jpeg: 2 }[p[3]] ?? 3;
  return { map: p[1], kind: p[2] ? "lower" : "image", rank: (name.includes("_radar") ? 10 : 0) + ext };
}
