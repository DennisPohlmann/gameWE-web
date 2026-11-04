// The radar generator (scripts/overviews): the parts that have to match
// Pillow, SciPy and NumPy to the pixel. Expected values come from those
// libraries. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { inflateSync } from "node:zlib";
import { lzmaDecode, parseEntities } from "../scripts/overviews/bsp.ts";
import { SIZE, dilate, encodePng, erode, fillPolygon, nearestValid, npSum, percentile, pyFloat, pyRound, rint } from "../scripts/overviews/draw.ts";

function polygon(xy: number[], w: number, h: number): string[] {
  const rows = Array.from({ length: h }, () => ".".repeat(w).split(""));
  fillPolygon(Int32Array.from(xy), w, h, (a, y, b) => {
    for (let x = a; x <= b; x++) rows[y][x] = "#";
  });
  return rows.map((r) => r.join(""));
}

test("polygon filling follows Pillow", () => {
  // ImageDraw.polygon([(1,0),(5,2),(1,4)], fill=1, outline=1) in mode "1"
  assert.deepEqual(polygon([1, 0, 5, 2, 1, 4], 6, 5), [".#....", ".###..", ".#####", ".###..", ".#...."]);
  // reaches over the rim: clipped
  assert.deepEqual(polygon([-2, -2, 9, -2, 9, 1, -2, 1], 3, 2), ["###", "###"]);
});

test("rounding as in NumPy and Python", () => {
  assert.deepEqual([0.5, 1.5, 2.5, -0.5, -1.5, 2.4].map(rint).map((v) => v + 0), [0, 2, 2, 0, -2, 2]);
  assert.equal(pyRound(0.125, 2), 0.12);
  assert.equal(pyRound(0.375, 2), 0.38);
  assert.equal(pyRound(-2436.914, 2), -2436.91);
  assert.equal(pyFloat(3290), "3290.0");
  assert.equal(pyFloat(-2436.91), "-2436.91");
  assert.equal(pyFloat(-0), "-0.0");
});

test("sums and percentiles as in NumPy", () => {
  // np.percentile(np.array(range(1000), dtype=np.float32), 2) and 98
  const v = Float32Array.from({ length: 1000 }, (_, i) => i);
  assert.equal(percentile(v, 2), 19.979999542236328);
  assert.equal(percentile(v, 98), 979.02001953125);
  // np.sum: the order of adding decides the last bit
  assert.equal(npSum(Array.from({ length: 20 }, (_, i) => (i % 2 ? 1e16 : 1.5))), 1.0000000000000002e17);
  assert.equal(npSum(Array.from({ length: 20 }, (_, i) => (i % 3 === 0 ? 1e16 : 1.5))), 7.000000000000002e16);
});

test("erosion takes the outside as empty, dilation does not", () => {
  const m = new Uint8Array(SIZE * SIZE).fill(1);
  const e = erode(m, 2);
  assert.equal(e[0], 0);
  assert.equal(e[SIZE * 2 + 2], 1);
  assert.equal(e[SIZE * 2 + 1], 0);
  const one = new Uint8Array(SIZE * SIZE);
  one[SIZE * 5 + 5] = 1;
  const d = dilate(one, 2);
  assert.equal(d[SIZE * 5 + 7], 1);
  assert.equal(d[SIZE * 6 + 7], 0);
  assert.equal(d[SIZE * 6 + 6], 1);
});

test("the nearest valid pixel, ties as in SciPy", () => {
  const m = new Uint8Array(SIZE * SIZE);
  m[SIZE * 10 + 10] = 1;
  m[SIZE * 10 + 14] = 1;
  const n = nearestValid(m);
  assert.equal(n[SIZE * 10 + 11], SIZE * 10 + 10);
  assert.equal(n[SIZE * 10 + 13], SIZE * 10 + 14);
  // equally near: distance_transform_edt takes the first one
  assert.equal(n[SIZE * 10 + 12], SIZE * 10 + 10);
});

test("LZMA: a stream made by liblzma", () => {
  // lzma.compress(text, FORMAT_RAW, LZMA1 lc=3 lp=0 pb=2)
  const src = Buffer.from("00341949ee8de9560ae77998acda70ed5a0246c23800fffff722c000", "hex");
  const text = "hello hello hello hello, gameWE gameWE gameWE";
  assert.equal(lzmaDecode(src, 3, 0, 2, text.length).toString("latin1"), text);
  assert.throws(() => lzmaDecode(Buffer.alloc(3), 3, 0, 2, 1), /truncated/);
});

test("entities: the first value of a key wins, the text ends at the first zero byte", () => {
  const e = parseEntities(Buffer.from('{\n"classname" "a"\n"classname" "b"\n"origin" "1 2 3"\n}\n{"__proto__" "x"}\0{"late" "no"}', "latin1"));
  assert.equal(e.length, 2);
  assert.equal(e[0].get("classname"), "a");
  assert.equal(e[1].get("__proto__"), "x");
});

test("the PNG holds the pixels", () => {
  const rgba = new Uint8Array(SIZE * SIZE * 4);
  rgba.set([1, 2, 3, 4], 4);
  const png = encodePng(rgba);
  assert.equal(png.toString("latin1", 1, 4), "PNG");
  assert.equal(png.readUInt32BE(16), SIZE);
  const at = png.indexOf("IDAT");
  const raw = inflateSync(png.subarray(at + 4, at + 4 + png.readUInt32BE(at - 4)));
  assert.equal(raw.length, (SIZE * 4 + 1) * SIZE);
});
