// Top-down radar picture of a Source map from its BSP (floors) and its
// navigation mesh (where players can walk).
//
// The pictures have to stay the same pixel by pixel whatever redraws them, so
// this follows exact rounding where it matters: heights are single precision
// as in the map files, polygon filling is that of Pillow's ImagingDrawPolygon,
// the nearest-floor search that of SciPy's feature transform (they decide
// ties), sums and percentiles those of NumPy.
import {
  BLOCKS_PLAYER,
  CONTENTS_SLIME,
  CONTENTS_WATER,
  SURF_NODRAW,
  SURF_SKY,
  SURF_SKY2D,
  SURF_TRIGGER,
  type Bsp,
  type Poly,
} from "./bsp.ts";
import { crc32, deflateSync } from "node:zlib";

export const SIZE = 2048;
export const REF = 1024;

// Highest drop the walk takes: deeper falls kill (or lead off the map).
const MAX_DROP = 400;
// Brush entities that always stand in the way (invisible walls and the like).
const WALLS = ["func_brush", "func_wall", "func_wall_toggle"];

const f32 = Math.fround;

function pairwiseSum(a: ArrayLike<number>, from: number, n: number): number {
  if (n < 8) {
    let res = 0;
    for (let i = 0; i < n; i++) res += a[from + i];
    return res;
  }
  if (n <= 128) {
    const r = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => a[from + j]);
    let i = 8;
    for (; i < n - n % 8; i += 8) for (let j = 0; j < 8; j++) r[j] += a[from + i + j];
    let res = r[0] + r[1] + (r[2] + r[3]) + (r[4] + r[5] + (r[6] + r[7]));
    for (; i < n; i++) res += a[from + i];
    return res;
  }
  let n2 = Math.floor(n / 2);
  n2 -= n2 % 8;
  return pairwiseSum(a, from, n2) + pairwiseSum(a, from + n2, n - n2);
}

/** Sum as NumPy adds up an array, which is what decides the last bit. */
export function npSum(a: ArrayLike<number>): number {
  return a.length ? a[0] + pairwiseSum(a, 1, a.length - 1) : 0;
}

function column(p: Poly, axis: number): Float64Array {
  const out = new Float64Array(p.length / 3);
  for (let i = 0; i < out.length; i++) out[i] = p[i * 3 + axis];
  return out;
}

const meanZ = (p: Poly) => {
  const z = column(p, 2);
  return npSum(z) / z.length;
};

/** Stable sort by the mean height. */
function byHeight(polys: Poly[]): Poly[] {
  const m = polys.map(meanZ);
  return polys.map((_, i) => i).sort((a, b) => m[a] - m[b]).map((i) => polys[i]);
}

/** Round half to even, as NumPy and Python do. */
export function rint(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export function readNav(b: Buffer): [number, number[][]] {
  const magic = b.readUInt32LE(0);
  const version = b.readUInt32LE(4);
  if (magic !== 0xfeedface) throw new Error("not a nav file");
  let o = 8;
  if (version >= 10) o += 4; // subversion
  if (version >= 4) o += 4; // bsp size
  if (version >= 14) o += 1; // analyzed
  if (version >= 5) {
    const n = b.readUInt16LE(o);
    o += 2;
    for (let i = 0; i < n; i++) o += 2 + b.readUInt16LE(o);
    if (version > 11) o += 1;
  }
  const count = b.readUInt32LE(o);
  o += 4;
  const areas: number[][] = [];
  let custom: number | null = null;
  for (let a = 0; a < count; a++) {
    o += 4; // id
    o += version <= 8 ? 1 : version <= 12 ? 2 : 4;
    // north-west x y z, south-east x y z, north-east z, south-west z
    areas.push([0, 4, 8, 12, 16, 20, 24, 28].map((d) => b.readFloatLE(o + d)));
    o += 32;
    for (let d = 0; d < 4; d++) o += 4 + 4 * b.readUInt32LE(o);
    o += 1 + b.readUInt8(o) * (version >= 2 ? 17 : 12);
    if (version < 15) o += 1 + 14 * b.readUInt8(o);
    const encounters = b.readUInt32LE(o);
    o += 4;
    for (let e = 0; e < encounters; e++) {
      o += 4 + 1 + 4 + 1;
      o += 1 + 5 * b.readUInt8(o);
    }
    if (version >= 5) o += 2;
    for (let d = 0; d < 2; d++) o += 4 + 4 * b.readUInt32LE(o);
    if (version >= 8) o += 8;
    if (version >= 11) o += 16;
    if (version >= 16) {
      o += 4 + 5 * b.readUInt32LE(o);
      o += 4;
    }
    // Game-specific data may follow (CS:S: one byte); skip to where the next
    // area plausibly starts.
    if (areas.length < count) {
      custom ??= customSize(b, o, version);
      o += custom;
    }
  }
  return [version, areas];
}

function plausible(b: Buffer, o: number, version: number): boolean {
  const att = version <= 8 ? 1 : version <= 12 ? 2 : 4;
  if (o + 4 + att + 32 > b.length) return false;
  const id = b.readUInt32LE(o);
  const c = [0, 4, 8, 12, 16, 20, 24, 28].map((d) => b.readFloatLE(o + 4 + att + d));
  return id > 0 && id < 10_000_000 && c.every((v) => Math.abs(v) < 65536) && c[0] <= c[3] && c[1] <= c[4];
}

function customSize(b: Buffer, o: number, version: number): number {
  for (let k = 0; k < 16; k++) if (plausible(b, o + k, version) && b.readUInt8(o + k + 3) === 0) return k;
  throw new Error("nav area layout not understood");
}

export function navPolys(areas: number[][]): Poly[] {
  return areas.map(([x0, y0, z0, x1, y1, z1, nez, swz]) => Float64Array.of(x0, y0, z0, x1, y0, nez, x1, y1, z1, x0, y1, swz));
}

export function floorFaces(bsp: Bsp): Poly[] {
  const m = bsp.models[0];
  const polys: Poly[] = [];
  for (let fi = m.firstFace; fi < m.firstFace + m.numFaces; fi++) {
    const f = bsp.face(fi);
    if (f.texinfo < 0) continue;
    if (bsp.texFlags(f.texinfo) & (SURF_SKY | SURF_SKY2D | SURF_NODRAW | SURF_TRIGGER)) continue;
    const name = bsp.texname(f.texinfo);
    if (name.startsWith("tools/") || name.includes("water")) continue;
    if (f.dispinfo >= 0) {
      for (const t of bsp.dispSurface(fi)) {
        const [ax, ay, az] = [t[3] - t[0], t[4] - t[1], t[5] - t[2]];
        const [bx, by, bz] = [t[6] - t[0], t[7] - t[1], t[8] - t[2]];
        const nx = ay * bz - az * by;
        const ny = az * bx - ax * bz;
        const nz = ax * by - ay * bx;
        const ln = Math.sqrt(nx * nx + ny * ny + nz * nz);
        if (ln > 0 && Math.abs(nz) / ln > 0.7) polys.push(t);
      }
      continue;
    }
    const nz = bsp.planeNormalZ(f.plane) * (f.side ? -1 : 1);
    if (nz < f32(0.7)) continue;
    polys.push(bsp.facePolygon(fi));
  }
  return polys;
}

/** The numbers of an `origin` value; null if one is no number. */
function origin(value: string): number[] | null {
  const parts = value.trim().split(/\s+/);
  if (!parts.every((v) => /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(v))) return null;
  if (parts.length !== 3) throw new Error(`origin "${value}" is not a point`);
  return parts.map(Number);
}

function brushModel(bsp: Bsp, e: Map<string, string>) {
  const m = /^\*(\d+)$/.exec(e.get("model") ?? "");
  return m && Number(m[1]) < bsp.models.length ? bsp.models[Number(m[1])] : null;
}

/** Bounds of the trigger_hurt brushes (pits, the sea, the map's edge). */
function hurtBoxes(bsp: Bsp): [number[], number[]][] {
  const out: [number[], number[]][] = [];
  for (const e of bsp.entities) {
    const mm = e.get("classname") === "trigger_hurt" ? brushModel(bsp, e) : null;
    if (!mm) continue;
    const o = (e.has("origin") ? origin(e.get("origin")!) : null) ?? [0, 0, 0];
    out.push([mm.mins.map((v, i) => v + o[i]), mm.maxs.map((v, i) => v + o[i])]);
  }
  return out;
}

/** (head node, origin) of the solid wall entities. */
function wallModels(bsp: Bsp): [number, number[]][] {
  const out: [number, number[]][] = [];
  for (const e of bsp.entities) {
    if (!WALLS.includes(e.get("classname") as string)) continue;
    const mm = brushModel(bsp, e);
    if (!mm || e.get("Solidity") === "1" || e.get("StartDisabled") === "1") continue;
    out.push([mm.head, (e.has("origin") ? origin(e.get("origin")!) : null) ?? [0, 0, 0]]);
  }
  return out;
}

/** Walkable cells without a navigation mesh: floor points with room for a
 *  player, reached from the spawn points by walking (steps up to 20 units,
 *  jumps up to 44, drops up to MAX_DROP), not under water and not in a
 *  trigger_hurt. Returns squares like nav areas. */
export function synthNav(bsp: Bsp, floors: Poly[], cell = 16): Poly[] {
  const px: number[] = [];
  const py: number[] = [];
  const pz: number[] = [];
  for (const poly of floors) {
    const m = poly.length / 3;
    const col = [column(poly, 0), column(poly, 1), column(poly, 2)];
    // Newell's normal: faces often start with collinear vertices
    const newell = (a: number, b: number) => npSum(col[a].map((v, i) => (v - col[a][(i + 1) % m]) * (col[b][i] + col[b][(i + 1) % m])));
    const nx = newell(1, 2);
    const ny = newell(2, 0);
    const nz = newell(0, 1);
    if (Math.abs(nz) < 1e-6) continue;
    const startX = Math.floor(Math.min(...col[0]) / cell) * cell + cell / 2;
    const startY = Math.floor(Math.min(...col[1]) / cell) * cell + cell / 2;
    const countX = Math.ceil((Math.max(...col[0]) - startX) / cell);
    const countY = Math.ceil((Math.max(...col[1]) - startY) / cell);
    const sign = Math.sign(nz);
    for (let iy = 0; iy < countY; iy++) {
      const gy = startY + iy * cell;
      next: for (let ix = 0; ix < countX; ix++) {
        const gx = startX + ix * cell;
        // convex face (Source faces are convex): same side of every edge
        // (the turning direction from the normal, seen from above)
        for (let i = 0; i < m; i++) {
          const j = (i + 1) % m;
          const c = (col[0][j] - col[0][i]) * (gy - col[1][i]) - (col[1][j] - col[1][i]) * (gx - col[0][i]);
          if (!(c * sign >= -1e-6)) continue next;
        }
        px.push(gx);
        py.push(gy);
        pz.push(poly[2] - (nx * (gx - poly[0]) + ny * (gy - poly[1])) / nz);
      }
    }
  }
  if (!px.length) return [];
  const walls = wallModels(bsp);
  const blocked = (x: number, y: number, z: number) => {
    if (bsp.contents(x, y, z) & BLOCKS_PLAYER) return true;
    for (const [head, o] of walls) if (bsp.contents(x - o[0], y - o[1], z - o[2], head) & BLOCKS_PLAYER) return true;
    return false;
  };
  const hurts = hurtBoxes(bsp);
  const kept: number[] = [];
  for (let i = 0; i < px.length; i++) {
    const [x, y, z] = [px[i], py[i], pz[i]];
    // room for a player: not in a wall at the feet, the waist and the head
    if (blocked(x, y, z + 8) || blocked(x, y, z + 36) || blocked(x, y, z + 64)) continue;
    // not under water (sea, deep pools) and not in a trigger_hurt (death pits)
    if (bsp.contents(x, y, z + 36) & (CONTENTS_WATER | CONTENTS_SLIME)) continue;
    const zf = z + 8;
    if (hurts.some(([lo, hi]) => x >= lo[0] && x <= hi[0] && y >= lo[1] && y <= hi[1] && zf >= lo[2] && zf <= hi[2])) continue;
    kept.push(i);
  }
  // one point per cell and height (8 units), sorted by cell and height
  const kx = kept.map((i) => Math.floor(px[i] / cell));
  const ky = kept.map((i) => Math.floor(py[i] / cell));
  const kz = kept.map((i) => rint(pz[i] / 8));
  const order = kept.map((_, i) => i).sort((a, b) => kx[a] - kx[b] || ky[a] - ky[b] || kz[a] - kz[b]);
  const first = order.filter((o, i) => i === 0 || kx[o] !== kx[order[i - 1]] || ky[o] !== ky[order[i - 1]] || kz[o] !== kz[order[i - 1]]);
  const X = first.map((o) => px[kept[o]]);
  const Y = first.map((o) => py[kept[o]]);
  const Z = first.map((o) => pz[kept[o]]);
  const cols = new Map<string, number[]>();
  const colKey = (cx: number, cy: number) => `${cx},${cy}`;
  first.forEach((o, i) => {
    const k = colKey(kx[o], ky[o]);
    const c = cols.get(k);
    if (c) c.push(i);
    else cols.set(k, [i]);
  });
  const seeds: number[][] = [];
  for (const e of bsp.entities) {
    if (!(e.get("classname") ?? "").startsWith("info_player_") || !e.has("origin")) continue;
    const s = origin(e.get("origin")!);
    if (s) seeds.push(s);
  }
  if (!seeds.length) return [];
  const seen = new Uint8Array(first.length);
  let stack: number[] = [];
  for (const [sx, sy, sz] of seeds) {
    const cx = Math.floor(sx / cell);
    const cy = Math.floor(sy / cell);
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        for (const i of cols.get(colKey(cx + dx, cy + dy)) ?? []) {
          const dz = Z[i] - sz;
          if (dz > -80 && dz < 32 && !seen[i]) {
            seen[i] = 1;
            stack.push(i);
          }
        }
      }
    }
  }
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (stack.length) {
    const reached: number[] = [];
    for (const i of stack) {
      const o = first[i];
      for (const [dx, dy] of dirs) {
        for (const j of cols.get(colKey(kx[o] + dx, ky[o] + dy)) ?? []) {
          if (seen[j]) continue;
          const dz = Z[j] - Z[i];
          if (dz < -MAX_DROP || dz > 44) continue;
          // wall between two neighbours: test the midpoint at waist height
          if (!blocked((X[i] + X[j]) / 2, (Y[i] + Y[j]) / 2, Math.max(Z[i], Z[j]) + 40)) {
            seen[j] = 1;
            reached.push(j);
          }
        }
      }
    }
    stack = reached;
  }
  const out: Poly[] = [];
  const h = cell / 2;
  for (let i = 0; i < first.length; i++) {
    if (seen[i]) out.push(Float64Array.of(X[i] - h, Y[i] + h, Z[i], X[i] + h, Y[i] + h, Z[i], X[i] + h, Y[i] - h, Z[i], X[i] - h, Y[i] - h, Z[i]));
  }
  return out;
}

type Edge = { x0: number; y0: number; xmin: number; ymin: number; xmax: number; ymax: number; dx: number };

function makeEdge(x0: number, y0: number, x1: number, y1: number): Edge {
  return { x0, y0, xmin: Math.min(x0, x1), xmax: Math.max(x0, x1), ymin: Math.min(y0, y1), ymax: Math.max(y0, y1), dx: y0 === y1 ? 0 : f32(f32(x1 - x0) / (y1 - y0)) };
}

const roundf = (x: number) => (x >= 0 ? Math.floor(x + 0.5) : -Math.floor(0.5 - x));
const roundUp = (f: number) => (f >= 0 ? Math.floor(f32(f + 0.5)) : -Math.floor(f32(0.5 - f)));
const roundDown = (f: number) => (f >= 0 ? Math.ceil(f32(f - 0.5)) : -Math.ceil(f32(-f - 0.5)));

/** Filled polygon on a w x h picture, by Pillow's scan line rules. `xy` are
 *  whole pixels; `hline` gets every span, clipped to the picture. */
export function fillPolygon(xy: Int32Array, w: number, h: number, hline: (x0: number, y: number, x1: number) => void): void {
  const span = (x0: number, y: number, x1: number) => {
    if (y < 0 || y >= h || x0 >= w || x1 < 0) return;
    x0 = Math.max(x0, 0);
    x1 = Math.min(x1, w - 1);
    if (x0 <= x1) hline(x0, y, x1);
  };
  const count = xy.length / 2;
  if (count <= 0) return;
  const e: Edge[] = [];
  let i = 0;
  for (; i < count - 1; i++) {
    const [x0, y0, x1, y1] = [xy[i * 2], xy[i * 2 + 1], xy[i * 2 + 2], xy[i * 2 + 3]];
    if (y0 === y1 && i !== 0 && y0 === xy[i * 2 - 1]) {
      // a horizontal line right after another one
      const last = e[e.length - 1];
      if (x1 > x0 && x0 > xy[i * 2 - 2]) {
        last.xmax = x1;
        continue;
      } else if (x1 < x0 && x0 < xy[i * 2 - 2]) {
        last.xmin = x1;
        continue;
      }
    }
    e.push(makeEdge(x0, y0, x1, y1));
  }
  if (xy[i * 2] !== xy[0] || xy[i * 2 + 1] !== xy[1]) e.push(makeEdge(xy[i * 2], xy[i * 2 + 1], xy[0], xy[1]));
  let ymin = h - 1;
  let ymax = 0;
  const table: Edge[] = [];
  for (const c of e) {
    ymin = Math.min(ymin, c.ymin);
    ymax = Math.max(ymax, c.ymax);
    if (c.ymin === c.ymax) span(c.xmin, c.ymin, c.xmax);
    else table.push(c);
  }
  ymin = Math.max(ymin, 0);
  ymax = Math.min(ymax, h);
  const xx = new Float32Array(table.length * 2);
  const at = (c: Edge, y: number) => f32(f32((y - c.y0) * c.dx) + c.x0);
  for (let y = ymin; y <= ymax; y++) {
    let j = 0;
    for (let t = 0; t < table.length; t++) {
      const cur = table[t];
      if (y < cur.ymin || y > cur.ymax) continue;
      xx[j++] = at(cur, y);
      if (y === cur.ymax && y < ymax) {
        // needed to draw consistent polygons
        xx[j] = xx[j - 1];
        j++;
      } else if ((y === cur.ymin || y === cur.ymax) && cur.dx !== 0) {
        // connect discontiguous corners
        for (let k = 0; k < t; k++) {
          const other = table[k];
          if ((y !== other.ymin && y !== other.ymax) || other.dx === 0) continue;
          if (roundf(xx[j - 1]) !== roundf(at(other, y))) continue;
          const row = y + (y === cur.ymax ? -1 : 1);
          if (row < other.ymin || row > other.ymax) continue;
          const a = at(cur, row);
          const b = at(other, row);
          if (xx[j - 1] > f32(a + 1) && xx[j - 1] > f32(b + 1)) xx[j - 1] = roundf(Math.max(a, b)) + 1;
          else if (xx[j - 1] < f32(a - 1) && xx[j - 1] < f32(b - 1)) xx[j - 1] = roundf(Math.min(a, b)) - 1;
          break;
        }
      }
    }
    xx.subarray(0, j).sort();
    for (let s = 1; s < j; s += 2) span(roundUp(xx[s - 1]), y, roundDown(xx[s]));
  }
}

export class Canvas {
  minx: number;
  maxy: number;
  side: number;
  k: number;
  z: Float32Array;

  constructor(minx: number, maxy: number, side: number) {
    this.minx = minx;
    this.maxy = maxy;
    this.side = side;
    this.k = SIZE / side;
    this.z = new Float32Array(SIZE * SIZE).fill(-Infinity);
  }

  px(p: Poly): [Float64Array, Float64Array] {
    const n = p.length / 3;
    const x = new Float64Array(n);
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = (p[i * 3] - this.minx) * this.k;
      y[i] = (this.maxy - p[i * 3 + 1]) * this.k;
    }
    return [x, y];
  }

  fill(poly: Poly): void {
    const [x, y] = this.px(poly);
    let [lox, hix, loy, hiy] = [Infinity, -Infinity, Infinity, -Infinity];
    for (let i = 0; i < x.length; i++) {
      lox = Math.min(lox, x[i]);
      hix = Math.max(hix, x[i]);
      loy = Math.min(loy, y[i]);
      hiy = Math.max(hiy, y[i]);
    }
    const x0 = Math.max(0, Math.floor(lox));
    const y0 = Math.max(0, Math.floor(loy));
    const x1 = Math.min(SIZE - 1, Math.ceil(hix));
    const y1 = Math.min(SIZE - 1, Math.ceil(hiy));
    if (x1 < x0 || y1 < y0) return;
    const xy = new Int32Array(x.length * 2);
    for (let i = 0; i < x.length; i++) {
      xy[i * 2] = Math.trunc(x[i] - x0);
      xy[i * 2 + 1] = Math.trunc(y[i] - y0);
    }
    const zz = f32(meanZ(poly));
    const z = this.z;
    fillPolygon(xy, x1 - x0 + 1, y1 - y0 + 1, (a, row, b) => {
      const o = (row + y0) * SIZE + x0;
      for (let c = o + a; c <= o + b; c++) if (z[c] < zz) z[c] = zz;
    });
  }
}

/** City-block distance of each pixel to the nearest pixel that is set. With
 *  `rim`, the pixels just outside the picture count as set. */
function cityBlock(set: Uint8Array, rim: boolean): Int32Array {
  const far = 1 << 28;
  const d = new Int32Array(SIZE * SIZE);
  const edge = rim ? 0 : far;
  for (let y = 0, o = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++, o++) {
      d[o] = set[o] ? 0 : Math.min(far, (x ? d[o - 1] : edge) + 1, (y ? d[o - SIZE] : edge) + 1);
    }
  }
  for (let y = SIZE - 1, o = SIZE * SIZE - 1; y >= 0; y--) {
    for (let x = SIZE - 1; x >= 0; x--, o--) {
      d[o] = Math.min(d[o], (x < SIZE - 1 ? d[o + 1] : edge) + 1, (y < SIZE - 1 ? d[o + SIZE] : edge) + 1);
    }
  }
  return d;
}

/** n iterations of a binary dilation with the 4-neighbour cross. */
export function dilate(m: Uint8Array, n: number): Uint8Array {
  const d = cityBlock(m, false);
  return m.map((_, i) => (d[i] <= n ? 1 : 0));
}

/** n iterations of a binary erosion with the 4-neighbour cross; what lies
 *  outside the picture counts as empty. */
export function erode(m: Uint8Array, n: number): Uint8Array {
  const d = cityBlock(m.map((v) => (v ? 0 : 1)), true);
  return m.map((_, i) => (d[i] > n ? 1 : 0));
}

/** Drops the 4-connected areas of fewer than minSize pixels. */
function dropSpecks(m: Uint8Array, minSize: number): void {
  const label = new Int32Array(m.length);
  const sizes: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || label[s]) continue;
    const id = sizes.length + 1;
    let size = 0;
    label[s] = id;
    stack.push(s);
    while (stack.length) {
      const o = stack.pop()!;
      size++;
      const x = o % SIZE;
      for (const q of [x ? o - 1 : -1, x < SIZE - 1 ? o + 1 : -1, o >= SIZE ? o - SIZE : -1, o + SIZE < m.length ? o + SIZE : -1]) {
        if (q >= 0 && m[q] && !label[q]) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    sizes.push(size);
  }
  if (sizes.length <= 1) return;
  for (let i = 0; i < m.length; i++) if (m[i] && sizes[label[i] - 1] < minSize) m[i] = 0;
}

// One line of SciPy's _VoronoiFT. `primary` holds the coordinate along the
// line (axis d), `other` the one across it; ftY < 0 marks "no feature yet".
function voronoiLine(primary: Int32Array, other: Int32Array, ftY: Int32Array, base: number, stride: number, across: number, f: Int32Array, fo: Int32Array, g: Int32Array): void {
  let l = -1;
  for (let ii = 0; ii < SIZE; ii++) {
    const o = base + ii * stride;
    f[ii] = primary[o];
    fo[ii] = other[o];
    if (ftY[o] < 0) continue;
    const fd = f[ii];
    const tw = fo[ii] - across;
    const wR = tw * tw;
    while (l >= 1) {
      const idx1 = g[l];
      const idx2 = g[l - 1];
      const f1 = f[idx1];
      const a = f1 - f[idx2];
      const b = fd - f1;
      const c = a + b;
      const tu = fo[idx2] - across;
      const tv = fo[idx1] - across;
      if (c * (tv * tv) - b * (tu * tu) - a * wR - a * b * c <= 0) break;
      l--;
    }
    g[++l] = ii;
  }
  const maxl = l;
  if (maxl < 0) return;
  l = 0;
  const dist = (i: number, ii: number) => {
    const t = f[i] - ii;
    const u = fo[i] - across;
    return t * t + u * u;
  };
  for (let ii = 0; ii < SIZE; ii++) {
    let delta1 = dist(g[l], ii);
    while (l < maxl) {
      const delta2 = dist(g[l + 1], ii);
      if (delta1 <= delta2) break;
      delta1 = delta2;
      l++;
    }
    const o = base + ii * stride;
    primary[o] = f[g[l]];
    other[o] = fo[g[l]];
  }
}

/** For each pixel the index of the nearest valid pixel (it decides which
 *  floor a gap takes its height from when several are equally near). */
export function nearestValid(valid: Uint8Array): Int32Array {
  const ftY = new Int32Array(SIZE * SIZE);
  const ftX = new Int32Array(SIZE * SIZE);
  for (let y = 0, o = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++, o++) {
      ftY[o] = valid[o] ? y : -1;
      ftX[o] = x;
    }
  }
  const f = new Int32Array(SIZE);
  const fo = new Int32Array(SIZE);
  const g = new Int32Array(SIZE);
  for (let x = 0; x < SIZE; x++) voronoiLine(ftY, ftX, ftY, x, SIZE, x, f, fo, g);
  for (let y = 0; y < SIZE; y++) voronoiLine(ftX, ftY, ftY, y * SIZE, 1, y, f, fo, g);
  return ftY.map((y, i) => y * SIZE + ftX[i]);
}

/** np.percentile of float32 values that are already sorted. */
export function percentile(sorted: Float32Array, q: number): number {
  const n = sorted.length;
  const virtual = f32(f32(n - 1) * f32(q / f32(100)));
  const above = virtual >= f32(n - 1);
  const prev = above ? n - 1 : Math.floor(virtual);
  const next = above ? n - 1 : prev + 1;
  const t = above ? f32(virtual - Math.floor(virtual)) : f32(virtual - prev);
  const a = sorted[prev];
  const b = sorted[next];
  const diff = f32(b - a);
  return t >= 0.5 ? f32(b - f32(diff * f32(1 - t))) : f32(a + f32(diff * t));
}

/** Min (or max) filter over a square window; beyond the picture the rim
 *  pixels repeat. */
function rankWindow(m: Uint8Array, radius: number, max: boolean): Uint8Array {
  const out = new Uint8Array(m.length);
  const hit = max ? 1 : 0;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let found = false;
      for (let dy = -radius; dy <= radius && !found; dy++) {
        const row = Math.min(SIZE - 1, Math.max(0, y + dy)) * SIZE;
        for (let dx = -radius; dx <= radius; dx++) {
          if (m[row + Math.min(SIZE - 1, Math.max(0, x + dx))] === hit) {
            found = true;
            break;
          }
        }
      }
      out[y * SIZE + x] = found === max ? 1 : 0;
    }
  }
  return out;
}

/** The picture as RGBA bytes. */
export function draw(canvas: Canvas, floors: Poly[], navpolys: Poly[]): Uint8Array {
  let navz: Float32Array | null = null;
  if (navpolys.length) {
    const c = new Canvas(canvas.minx, canvas.maxy, canvas.side);
    for (const p of byHeight(navpolys)) c.fill(p);
    navz = c.z;
  }
  // Floor faces near a walkable nav area (same height within a step): keeps
  // the floors and leaves roofs and the void out.
  const clip = (v: number) => Math.min(SIZE - 1, Math.max(0, Math.trunc(v)));
  for (const p of byHeight(floors)) {
    if (navz) {
      const [x, y] = canvas.px(p);
      const zc = column(p, 2);
      const near = (px: number, py: number, zf: number) => {
        const nz = navz![clip(py) * SIZE + clip(px)];
        return Number.isFinite(nz) && Math.abs(nz - zf) < 40;
      };
      let keep = near(npSum(x) / x.length, npSum(y) / y.length, npSum(zc) / zc.length);
      for (let i = 0; i < x.length && !keep; i++) keep = near(x[i], y[i], zc[i]);
      if (!keep) continue;
    }
    canvas.fill(p);
  }
  let z = canvas.z;
  if (navz) {
    const walk = navz.map((v) => (Number.isFinite(v) ? 1 : 0));
    // Nav areas keep about a player's half width from the walls; the floor
    // faces reach the walls. Faces count up to ~48 units from a walkable area,
    // nav areas fill what the faces left open.
    const near = dilate(Uint8Array.from(walk), Math.max(1, Math.trunc(48 * canvas.k)));
    for (let i = 0; i < z.length; i++) {
      if (!near[i]) z[i] = -Infinity;
      if (!Number.isFinite(z[i]) && walk[i]) z[i] = navz[i];
    }
  }
  const valid = Uint8Array.from(z, (v) => (Number.isFinite(v) ? 1 : 0));
  // Smooth outline: close small gaps, drop specks, fill holes' heights from
  // the nearest floor.
  const r = Math.max(1, rint(12 * canvas.k));
  const half = Math.max(1, Math.floor(r / 2));
  const smooth = dilate(erode(erode(dilate(valid, r), r), half), half);
  dropSpecks(smooth, (64 * canvas.k) ** 2);
  if (!valid.includes(1)) throw new Error("nothing to draw");
  const nearest = nearestValid(valid);
  const filled = new Float32Array(z.length);
  for (let i = 0; i < z.length; i++) filled[i] = smooth[i] ? z[nearest[i]] : -Infinity;
  z = filled;
  const shown = z.filter(Number.isFinite).sort();
  if (!shown.length) throw new Error("nothing to draw");
  const lo = percentile(shown, 2);
  const hi = percentile(shown, 98);
  const range = f32(hi - lo) > 1 ? f32(hi - lo) : 1;
  const dark = [38, 44, 60];
  const diff = [54, 58, 68];
  const img = new Uint8Array(z.length * 4);
  const shownMask = new Uint8Array(z.length);
  for (let i = 0; i < z.length; i++) {
    const t = Math.min(1, Math.max(0, f32(f32(z[i] - lo) / range)));
    for (let c = 0; c < 3; c++) img[i * 4 + c] = Math.trunc(f32(dark[c] + f32(diff[c] * t)));
    if (Number.isFinite(z[i])) {
      img[i * 4 + 3] = 255;
      shownMask[i] = 1;
    }
  }
  // Outline of the playable area and lines at height steps.
  const zf = z.map((v, i) => (shownMask[i] ? v : -1e9));
  const step = new Uint8Array(z.length);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const o = y * SIZE + x;
      if ((x < SIZE - 1 && Math.abs(f32(zf[o] - zf[o + 1])) > 40) || (y < SIZE - 1 && Math.abs(f32(zf[o] - zf[o + SIZE])) > 40)) step[o] = 1;
    }
  }
  const inner3 = rankWindow(shownMask, 1, false);
  const edge = rankWindow(shownMask.map((v, i) => (v && !inner3[i] ? 1 : 0)), 2, true);
  const lift = 255 * 0.6;
  for (let i = 0; i < z.length; i++) {
    const o = i * 4;
    if (edge[i]) {
      img[o] = 235;
      img[o + 1] = 238;
      img[o + 2] = 245;
      img[o + 3] = 255;
    } else if (step[i] && shownMask[i]) {
      for (let c = 0; c < 3; c++) img[o + c] = Math.trunc(img[o + c] * 0.4 + lift);
    }
  }
  return img;
}

/** The picture as PNG, each row with the PNG filter that suits it best. */
export function encodePng(rgba: Uint8Array): Buffer {
  const row = SIZE * 4;
  const raw = Buffer.alloc((row + 1) * SIZE);
  const best = new Uint8Array(row);
  const line = new Uint8Array(row);
  for (let y = 0; y < SIZE; y++) {
    let bestSum = Infinity;
    let bestType = 0;
    const o = y * row;
    for (let type = 0; type < 5; type++) {
      let sum = 0;
      for (let i = 0; i < row; i++) {
        const a = i >= 4 ? rgba[o + i - 4] : 0;
        const b = y ? rgba[o + i - row] : 0;
        const c = y && i >= 4 ? rgba[o + i - row - 4] : 0;
        let pred = 0;
        if (type === 1) pred = a;
        else if (type === 2) pred = b;
        else if (type === 3) pred = (a + b) >> 1;
        else if (type === 4) {
          const [pa, pb, pc] = [Math.abs(b - c), Math.abs(a - c), Math.abs(a + b - 2 * c)];
          pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        }
        const v = (rgba[o + i] - pred) & 0xff;
        line[i] = v;
        sum += v < 128 ? v : 256 - v;
      }
      if (sum < bestSum) {
        bestSum = sum;
        bestType = type;
        best.set(line);
      }
    }
    raw[y * (row + 1)] = bestType;
    raw.set(best, y * (row + 1) + 1);
  }
  const chunk = (name: string, data: Buffer) => {
    const out = Buffer.alloc(data.length + 12);
    out.writeUInt32BE(data.length, 0);
    out.write(name, 4, "latin1");
    data.copy(out, 8);
    out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
    return out;
  };
  const head = Buffer.alloc(13);
  head.writeUInt32BE(SIZE, 0);
  head.writeUInt32BE(SIZE, 4);
  head[8] = 8; // bits per channel
  head[9] = 6; // RGBA
  return Buffer.concat([Buffer.from("\x89PNG\r\n\x1a\n", "latin1"), chunk("IHDR", head), chunk("IDAT", deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

export const low = (split: number) => (p: Poly) => meanZ(p) <= split;

/** round(x, digits) of Python: an exact tie goes to the even digit. */
export function pyRound(x: number, digits: number): number {
  const exact = x.toFixed(100);
  const cut = exact.indexOf(".") + 1 + digits;
  if (/^50*$/.test(exact.slice(cut)) && Number(exact[cut - 1]) % 2 === 0) return Number(exact.slice(0, cut));
  return Number(x.toFixed(digits));
}

/** A float as Python's repr and JSON write it. */
export function pyFloat(x: number): string {
  if (Object.is(x, -0)) return "-0.0";
  return Number.isInteger(x) ? `${x}.0` : String(x);
}
