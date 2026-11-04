// bzip2 decoder (Node has none), with a limit on what comes out: a small file
// can unpack to gigabytes. Follows the format as bzip2 1.0 writes it.

const CRC_TABLE = Int32Array.from({ length: 256 }, (_, i) => {
  let c = i << 24;
  for (let k = 0; k < 8; k++) c = c & 0x80000000 ? (c << 1) ^ 0x04c11db7 : c << 1;
  return c;
});

export function bunzip2(src: Buffer, maxOut: number): Buffer {
  let bitPos = 0;
  const bits = (n: number): number => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      const byte = bitPos >>> 3;
      if (byte >= src.length) throw new Error("truncated bzip2 file");
      v = v * 2 + ((src[byte] >> (7 - (bitPos & 7))) & 1);
      bitPos++;
    }
    return v;
  };
  let out = Buffer.allocUnsafe(Math.min(maxOut, Math.max(1 << 20, src.length * 4)));
  let outPos = 0;
  const reserve = (n: number) => {
    if (outPos + n > maxOut) throw new Error(`bzip2 output over the limit of ${maxOut} bytes`);
    if (outPos + n <= out.length) return;
    const bigger = Buffer.allocUnsafe(Math.min(maxOut, Math.max(out.length * 2, outPos + n)));
    out.copy(bigger, 0, 0, outPos);
    out = bigger;
  };
  do {
    if (bits(24) !== 0x425a68) throw new Error("not a bzip2 file");
    const level = bits(8) - 0x30;
    if (level < 1 || level > 9) throw new Error("bad bzip2 level");
    const tt = new Uint32Array(level * 100000);
    for (;;) {
      const magic = bits(48);
      if (magic === 0x177245385090) {
        bits(32);
        bitPos = (bitPos + 7) & ~7;
        break;
      }
      if (magic !== 0x314159265359) throw new Error("bad bzip2 block");
      const blockCrc = bits(32) | 0;
      if (bits(1)) throw new Error("randomised bzip2 blocks are not supported");
      const origPtr = bits(24);
      const used = bits(16);
      const symbols: number[] = [];
      for (let i = 0; i < 16; i++) {
        if (!(used & (0x8000 >> i))) continue;
        const row = bits(16);
        for (let j = 0; j < 16; j++) if (row & (0x8000 >> j)) symbols.push(i * 16 + j);
      }
      if (!symbols.length) throw new Error("bad bzip2 block");
      const alpha = symbols.length + 2;
      const groups = bits(3);
      if (groups < 2 || groups > 6) throw new Error("bad bzip2 block");
      const selCount = bits(15);
      if (selCount < 1) throw new Error("bad bzip2 block");
      const selMtf = Array.from({ length: groups }, (_, i) => i);
      const selectors = new Uint8Array(selCount);
      for (let i = 0; i < selCount; i++) {
        let j = 0;
        while (bits(1)) if (++j >= groups) throw new Error("bad bzip2 block");
        const g = selMtf.splice(j, 1)[0];
        selMtf.unshift(g);
        selectors[i] = g;
      }
      const tables = [];
      for (let t = 0; t < groups; t++) {
        const lens = new Uint8Array(alpha);
        let len = bits(5);
        for (let i = 0; i < alpha; i++) {
          for (;;) {
            if (len < 1 || len > 20) throw new Error("bad bzip2 block");
            if (!bits(1)) break;
            len += bits(1) ? -1 : 1;
          }
          lens[i] = len;
        }
        // canonical code: per length the first code and where its symbols start
        const count = new Int32Array(22);
        for (const l of lens) count[l]++;
        const perm: number[] = [];
        for (let l = 1; l <= 20; l++) for (let i = 0; i < alpha; i++) if (lens[i] === l) perm.push(i);
        const limit = new Int32Array(22);
        const base = new Int32Array(22);
        let code = 0;
        let index = 0;
        for (let l = 1; l <= 20; l++) {
          base[l] = index - code;
          code += count[l];
          index += count[l];
          limit[l] = code - 1;
          code *= 2;
        }
        tables.push({ limit, base, perm, count });
      }
      // Huffman and zero runs to the block of the Burrows-Wheeler transform
      const mtf = Array.from(symbols.keys());
      const eob = alpha - 1;
      const freq = new Int32Array(256);
      let n = 0;
      let run = 0;
      let runBit = 1;
      let group = -1;
      let left = 0;
      let table = tables[0];
      for (;;) {
        if (left === 0) {
          group++;
          if (group >= selCount) throw new Error("bad bzip2 block");
          table = tables[selectors[group]];
          left = 50;
        }
        left--;
        let l = 1;
        let code = bits(1);
        while (table.count[l] === 0 || code > table.limit[l]) {
          if (++l > 20) throw new Error("bad bzip2 block");
          code = code * 2 + bits(1);
        }
        const sym = table.perm[code + table.base[l]];
        if (sym === undefined) throw new Error("bad bzip2 block");
        if (sym < 2) {
          run += runBit << sym;
          runBit *= 2;
          if (run > tt.length) throw new Error("bad bzip2 block");
          continue;
        }
        if (run > 0) {
          if (n + run > tt.length) throw new Error("bad bzip2 block");
          const byte = symbols[mtf[0]];
          freq[byte] += run;
          tt.fill(byte, n, n + run);
          n += run;
          run = 0;
          runBit = 1;
        }
        if (sym === eob) break;
        if (n >= tt.length) throw new Error("bad bzip2 block");
        const m = mtf.splice(sym - 1, 1)[0];
        mtf.unshift(m);
        const byte = symbols[m];
        freq[byte]++;
        tt[n++] = byte;
      }
      if (origPtr >= n) throw new Error("bad bzip2 block");
      // the inverse transform, then the runs of four equal bytes
      const start = new Int32Array(256);
      for (let i = 1; i < 256; i++) start[i] = start[i - 1] + freq[i - 1];
      for (let i = 0; i < n; i++) tt[start[tt[i] & 0xff]++] |= i << 8;
      let crc = -1;
      let pos = tt[origPtr] >>> 8;
      let same = 0;
      let prev = -1;
      for (let i = 0; i < n; i++) {
        const e = tt[pos];
        const byte = e & 0xff;
        pos = e >>> 8;
        let times = 1;
        if (same === 4) {
          times = byte;
          same = 0;
          if (!times) continue;
          reserve(times);
          out.fill(prev, outPos, outPos + times);
          outPos += times;
          for (let t = 0; t < times; t++) crc = (crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ prev) & 0xff];
          continue;
        }
        same = byte === prev ? same + 1 : 1;
        prev = byte;
        reserve(1);
        out[outPos++] = byte;
        crc = (crc << 8) ^ CRC_TABLE[((crc >>> 24) ^ byte) & 0xff];
      }
      if (~crc !== blockCrc) throw new Error("bzip2 block with a wrong checksum");
    }
  } while (bitPos >>> 3 < src.length);
  return out.subarray(0, outPos);
}
