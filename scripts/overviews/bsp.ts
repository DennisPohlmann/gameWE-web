// Minimal reader for Source (VBSP v19-21) map files: what a top-down radar needs.

const CONTENTS_SOLID = 0x1;
const CONTENTS_WINDOW = 0x2;
const CONTENTS_GRATE = 0x8;
export const CONTENTS_SLIME = 0x10;
export const CONTENTS_WATER = 0x20;
const CONTENTS_MOVEABLE = 0x4000;
const CONTENTS_PLAYERCLIP = 0x10000;
export const BLOCKS_PLAYER = CONTENTS_SOLID | CONTENTS_WINDOW | CONTENTS_GRATE | CONTENTS_PLAYERCLIP | CONTENTS_MOVEABLE;

export const SURF_SKY2D = 0x2;
export const SURF_SKY = 0x4;
export const SURF_TRIGGER = 0x40;
export const SURF_NODRAW = 0x80;

/** Points of a polygon, x y z after each other. */
export type Poly = Float64Array;

const f32 = Math.fround;

/** Raw LZMA1 stream (after the LZMA specification) to exactly `size` bytes. */
export function lzmaDecode(src: Buffer, lc: number, lp: number, pb: number, size: number): Buffer {
  const out = Buffer.alloc(size);
  let ip = 5;
  if (src.length < 5) throw new Error("truncated LZMA lump");
  let code = src.readUInt32BE(1);
  let range = 0xffffffff;
  const next = () => {
    if (ip >= src.length) throw new Error("truncated LZMA lump");
    return src[ip++];
  };
  const bit = (p: Uint16Array, i: number) => {
    const bound = ((range >>> 11) * p[i]) >>> 0;
    let b: number;
    if (code < bound) {
      range = bound;
      p[i] += (2048 - p[i]) >>> 5;
      b = 0;
    } else {
      range = (range - bound) >>> 0;
      code = (code - bound) >>> 0;
      p[i] -= p[i] >>> 5;
      b = 1;
    }
    if (range < 0x1000000) {
      range = (range * 256) >>> 0;
      code = ((code * 256) + next()) >>> 0;
    }
    return b;
  };
  const probs = (n: number) => new Uint16Array(n).fill(1024);
  const tree = (p: Uint16Array, base: number, bits: number) => {
    let m = 1;
    for (let i = 0; i < bits; i++) m = (m << 1) + bit(p, base + m);
    return m - (1 << bits);
  };
  const reverse = (p: Uint16Array, base: number, bits: number) => {
    let m = 1;
    let v = 0;
    for (let i = 0; i < bits; i++) {
      const b = bit(p, base + m);
      m = (m << 1) + b;
      v |= b << i;
    }
    return v;
  };
  const direct = (bits: number) => {
    let v = 0;
    for (; bits > 0; bits--) {
      range >>>= 1;
      const b = code >= range ? 1 : 0;
      if (b) code = (code - range) >>> 0;
      v = ((v << 1) | b) >>> 0;
      if (range < 0x1000000) {
        range = (range * 256) >>> 0;
        code = ((code * 256) + next()) >>> 0;
      }
    }
    return v;
  };
  const posStates = 1 << pb;
  const lengthCoder = () => ({ choice: probs(2), low: probs(posStates << 3), mid: probs(posStates << 3), high: probs(256) });
  const readLength = (c: ReturnType<typeof lengthCoder>, ps: number) => {
    if (!bit(c.choice, 0)) return tree(c.low, ps << 3, 3);
    if (!bit(c.choice, 1)) return 8 + tree(c.mid, ps << 3, 3);
    return 16 + tree(c.high, 0, 8);
  };
  const literal = probs(0x300 << (lc + lp));
  const isMatch = probs(12 << 4);
  const isRep = probs(12);
  const isRepG0 = probs(12);
  const isRepG1 = probs(12);
  const isRepG2 = probs(12);
  const isRep0Long = probs(12 << 4);
  const posSlot = probs(4 << 6);
  const posSpecial = probs(115);
  const align = probs(16);
  const len = lengthCoder();
  const repLen = lengthCoder();
  let state = 0;
  let rep0 = 0;
  let rep1 = 0;
  let rep2 = 0;
  let rep3 = 0;
  let pos = 0;
  while (pos < size) {
    const ps = pos & (posStates - 1);
    if (!bit(isMatch, (state << 4) + ps)) {
      const prev = pos > 0 ? out[pos - 1] : 0;
      const base = 0x300 * (((pos & ((1 << lp) - 1)) << lc) + (prev >> (8 - lc)));
      let sym = 1;
      if (state >= 7) {
        let match = out[pos - rep0 - 1];
        do {
          const mb = (match >> 7) & 1;
          match = (match << 1) & 0xff;
          const b = bit(literal, base + ((1 + mb) << 8) + sym);
          sym = (sym << 1) | b;
          if (mb !== b) break;
        } while (sym < 0x100);
      }
      while (sym < 0x100) sym = (sym << 1) | bit(literal, base + sym);
      out[pos++] = sym & 0xff;
      state = state < 4 ? 0 : state < 10 ? state - 3 : state - 6;
      continue;
    }
    let l: number;
    if (bit(isRep, state)) {
      if (!bit(isRepG0, state)) {
        if (!bit(isRep0Long, (state << 4) + ps)) {
          state = state < 7 ? 9 : 11;
          if (rep0 >= pos) throw new Error("bad LZMA lump");
          out[pos] = out[pos - rep0 - 1];
          pos++;
          continue;
        }
      } else {
        let d: number;
        if (!bit(isRepG1, state)) d = rep1;
        else {
          if (!bit(isRepG2, state)) d = rep2;
          else {
            d = rep3;
            rep3 = rep2;
          }
          rep2 = rep1;
        }
        rep1 = rep0;
        rep0 = d;
      }
      l = readLength(repLen, ps);
      state = state < 7 ? 8 : 11;
    } else {
      rep3 = rep2;
      rep2 = rep1;
      rep1 = rep0;
      l = readLength(len, ps);
      state = state < 7 ? 7 : 10;
      const slot = tree(posSlot, Math.min(l, 3) << 6, 6);
      if (slot < 4) rep0 = slot;
      else {
        const bits = (slot >> 1) - 1;
        rep0 = (2 | (slot & 1)) * 2 ** bits;
        if (slot < 14) rep0 += reverse(posSpecial, rep0 - slot, bits);
        else rep0 += direct(bits - 4) * 16 + reverse(align, 0, 4);
      }
    }
    if (rep0 >= pos) throw new Error("bad LZMA lump");
    for (let n = Math.min(l + 2, size - pos); n > 0; n--, pos++) out[pos] = out[pos - rep0 - 1];
  }
  return out;
}

// More than any real lump, against a small one that claims to unpack to gigabytes.
const MAX_LUMP = 512 * 1024 * 1024;

function unpackLump(data: Buffer): Buffer {
  if (data.length < 4 || data.toString("latin1", 0, 4) !== "LZMA") return data;
  const actual = data.readUInt32LE(4);
  if (actual > MAX_LUMP) throw new Error("LZMA lump too large");
  const d = data[12];
  return lzmaDecode(data.subarray(17), d % 9, Math.floor(d / 9) % 5, Math.floor(d / 45), actual);
}

function records(lump: Buffer, size: number): number {
  if (lump.length % size) throw new Error("lump size is not a multiple of its record size");
  return lump.length / size;
}

export function parseEntities(raw: Buffer): Map<string, string>[] {
  const end = raw.indexOf(0);
  const text = raw.toString("latin1", 0, end < 0 ? raw.length : end);
  const ents: Map<string, string>[] = [];
  let cur: Map<string, string> | null = null;
  let key: string | null = null;
  for (const m of text.matchAll(/\{|\}|"((?:[^"\\]|\\[^\n])*)"/g)) {
    if (m[0] === "{") {
      cur = new Map();
      key = null;
    } else if (m[0] === "}") {
      if (cur) ents.push(cur);
      cur = null;
    } else if (cur) {
      if (key === null) key = m[1];
      else {
        if (!cur.has(key)) cur.set(key, m[1]);
        key = null;
      }
    }
  }
  return ents;
}

export type Model = { mins: number[]; maxs: number[]; head: number; firstFace: number; numFaces: number };

export class Bsp {
  version: number;
  lumps: Buffer[] = [];
  models: Model[] = [];
  entities: Map<string, string>[];
  numFaces: number;
  // the BSP trees, unpacked: a walk per point crosses them millions of times
  private planes: Float64Array;
  private nodePlane: Int32Array;
  private nodeChildren: Int32Array;
  private leafContents: Int32Array;

  constructor(raw: Buffer) {
    if (raw.toString("latin1", 0, 4) !== "VBSP") throw new Error("not a Source BSP");
    this.version = raw.readInt32LE(4);
    if (![19, 20, 21].includes(this.version)) throw new Error(`BSP version ${this.version}`);
    for (let i = 0; i < 64; i++) {
      const ofs = raw.readInt32LE(8 + 16 * i);
      const ln = raw.readInt32LE(12 + 16 * i);
      this.lumps.push(unpackLump(raw.subarray(ofs, ofs + ln)));
    }
    const L = this.lumps;
    this.numFaces = records(L[7], 56);
    records(L[3], 12);
    records(L[6], 72);
    records(L[12], 4);
    records(L[13], 4);
    records(L[2], 32);
    records(L[44], 4);
    records(L[33], 20);
    const planeCount = records(L[1], 20);
    this.planes = new Float64Array(planeCount * 4);
    for (let i = 0; i < planeCount * 4; i++) this.planes[i] = L[1].readFloatLE(i * 4 + (i >> 2) * 4);
    const nodeCount = records(L[5], 32);
    this.nodePlane = new Int32Array(nodeCount);
    this.nodeChildren = new Int32Array(nodeCount * 2);
    for (let i = 0; i < nodeCount; i++) {
      this.nodePlane[i] = L[5].readInt32LE(i * 32);
      this.nodeChildren[i * 2] = L[5].readInt32LE(i * 32 + 4);
      this.nodeChildren[i * 2 + 1] = L[5].readInt32LE(i * 32 + 8);
    }
    const leafSize = this.version === 19 ? 56 : 32;
    this.leafContents = new Int32Array(Math.floor(L[10].length / leafSize));
    for (let i = 0; i < this.leafContents.length; i++) this.leafContents[i] = L[10].readInt32LE(i * leafSize);
    const modelCount = records(L[14], 48);
    for (let i = 0; i < modelCount; i++) {
      const o = i * 48;
      this.models.push({
        mins: [L[14].readFloatLE(o), L[14].readFloatLE(o + 4), L[14].readFloatLE(o + 8)],
        maxs: [L[14].readFloatLE(o + 12), L[14].readFloatLE(o + 16), L[14].readFloatLE(o + 20)],
        head: L[14].readInt32LE(o + 36),
        firstFace: L[14].readInt32LE(o + 40),
        numFaces: L[14].readInt32LE(o + 44),
      });
    }
    this.entities = parseEntities(L[0]);
  }

  face(fi: number) {
    const o = fi * 56;
    const f = this.lumps[7];
    return {
      plane: f.readUInt16LE(o),
      side: f[o + 2],
      firstEdge: f.readInt32LE(o + 4),
      numEdges: f.readInt16LE(o + 8),
      texinfo: f.readInt16LE(o + 10),
      dispinfo: f.readInt16LE(o + 12),
    };
  }

  texFlags(ti: number): number {
    return this.lumps[6].readInt32LE(ti * 72 + 64);
  }

  planeNormalZ(pl: number): number {
    return this.lumps[1].readFloatLE(pl * 20 + 8);
  }

  texname(ti: number): string {
    const td = this.lumps[6].readInt32LE(ti * 72 + 68);
    if (td < 0) return "";
    const off = this.lumps[44].readInt32LE(this.lumps[2].readInt32LE(td * 32 + 12) * 4);
    const end = this.lumps[43].indexOf(0, off);
    if (end < 0) throw new Error("texture name without end");
    return this.lumps[43].toString("latin1", off, end).toLowerCase();
  }

  facePolygon(fi: number): Poly {
    const { firstEdge, numEdges } = this.face(fi);
    const p = new Float64Array(numEdges * 3);
    for (let i = 0; i < numEdges; i++) {
      const se = this.lumps[13].readInt32LE((firstEdge + i) * 4);
      const v = this.lumps[12].readUInt16LE(Math.abs(se) * 4 + (se >= 0 ? 0 : 2));
      p[i * 3] = this.lumps[3].readFloatLE(v * 12);
      p[i * 3 + 1] = this.lumps[3].readFloatLE(v * 12 + 4);
      p[i * 3 + 2] = this.lumps[3].readFloatLE(v * 12 + 8);
    }
    return p;
  }

  /** Triangles of a displacement face. The grid is worked out in single
   *  precision, as the map's own numbers are. */
  dispSurface(fi: number): Poly[] {
    const rec = 176;
    const di = this.face(fi).dispinfo * rec;
    const info = this.lumps[26];
    const start = [info.readFloatLE(di), info.readFloatLE(di + 4), info.readFloatLE(di + 8)];
    const firstVert = info.readInt32LE(di + 12);
    const power = info.readInt32LE(di + 20);
    if (power < 0 || power > 8) throw new Error("bad displacement");
    const corners = this.facePolygon(fi);
    if (corners.length !== 12) return [];
    // rotate so corner 0 is the start position
    let k = 0;
    let best = Infinity;
    for (let i = 0; i < 4; i++) {
      const d = Math.hypot(corners[i * 3] - start[0], corners[i * 3 + 1] - start[1], corners[i * 3 + 2] - start[2]);
      if (d < best) {
        best = d;
        k = i;
      }
    }
    const c = (i: number, a: number) => corners[((i + k) % 4) * 3 + a];
    const n = (1 << power) + 1;
    const verts = this.lumps[33];
    const available = Math.min(firstVert + n * n, verts.length / 20) - firstVert;
    const pts = new Float64Array(n * n * 3);
    for (let i = 0; i < n; i++) {
      const t = f32(i / (n - 1));
      for (let j = 0; j < n; j++) {
        const s = f32(j / (n - 1));
        const dv = i * n + j < available ? (firstVert + i * n + j) * 20 : -1;
        for (let a = 0; a < 3; a++) {
          const pa = f32(c(0, a) + f32(f32(c(1, a) - c(0, a)) * t));
          const pb = f32(c(3, a) + f32(f32(c(2, a) - c(3, a)) * t));
          let p = f32(pa + f32(f32(pb - pa) * s));
          if (dv >= 0) p = f32(p + f32(verts.readFloatLE(dv + a * 4) * verts.readFloatLE(dv + 12)));
          pts[(j * n + i) * 3 + a] = p;
        }
      }
    }
    const pt = (i: number, j: number, out: Float64Array, at: number) => {
      const o = (i * n + j) * 3;
      out[at] = pts[o];
      out[at + 1] = pts[o + 1];
      out[at + 2] = pts[o + 2];
    };
    const tris: Poly[] = [];
    for (let i = 0; i < n - 1; i++) {
      for (let j = 0; j < n - 1; j++) {
        const a = new Float64Array(9);
        pt(i, j, a, 0);
        pt(i + 1, j, a, 3);
        pt(i + 1, j + 1, a, 6);
        const b = new Float64Array(9);
        pt(i, j, b, 0);
        pt(i + 1, j + 1, b, 3);
        pt(i, j + 1, b, 6);
        tris.push(a, b);
      }
    }
    return tris;
  }

  /** Leaf contents at a point, through the world BSP tree (or the tree of a
   *  brush model, from its head node). */
  contents(x: number, y: number, z: number, head: number = this.models[0].head): number {
    let node = head;
    // a tree walk crosses every node at most once; more is a loop in a bad map
    for (let steps = 0; node >= 0; steps++) {
      if (steps > this.nodePlane.length) throw new Error("bad BSP tree");
      const pl = this.nodePlane[node] * 4;
      const back = x * this.planes[pl] + y * this.planes[pl + 1] + z * this.planes[pl + 2] - this.planes[pl + 3] < 0;
      node = this.nodeChildren[node * 2 + (back ? 1 : 0)];
      if (node === undefined) throw new Error("bad BSP tree");
    }
    const c = this.leafContents[-node - 1];
    if (c === undefined) throw new Error("bad BSP tree");
    return c;
  }
}
