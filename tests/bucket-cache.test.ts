// Frags per 15 minutes read incrementally (src/lib/bucket-cache.ts): the
// first load reads all, later loads only the last buckets, a full read once
// per fullEvery. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { bucketCache, type BucketRow } from "../src/lib/bucket-cache";

const step = 900;

test("first load reads from start, the next only the last two buckets", async () => {
  const c = bucketCache(step, 3_600_000);
  const froms: number[] = [];
  const start = 900 * 1000;
  let now = 900 * 1010 + 100;
  const rows1: BucketRow[] = [
    { h: 1000, a: 5, b: 1 },
    { h: 1009, a: 2, b: 0 },
    { h: 1010, a: 1, b: 1 },
  ];
  let m = await c("*", start, now, async (from) => (froms.push(from), rows1));
  assert.deepEqual([...m.entries()], [[1000, [5, 1]], [1009, [2, 0]], [1010, [1, 1]]]);
  now += 300; // five minutes later, same bucket 1010
  m = await c("*", start, now, async (from) => (froms.push(from), [{ h: 1010, a: 4, b: 2 }]));
  assert.deepEqual(froms, [start, 1009 * step]);
  // 1009 was re-read and had no frags any more: gone; 1010 updated; 1000 kept.
  assert.deepEqual([...m.entries()], [[1000, [5, 1]], [1010, [4, 2]]]);
});

test("old buckets fall out of the window, a full read comes back after fullEvery", async () => {
  const c = bucketCache(step, 60_000);
  const froms: number[] = [];
  await c("x", 900 * 100, 900 * 105, async (from) => (froms.push(from), [{ h: 100, a: 1, b: 0 }, { h: 105, a: 1, b: 0 }]));
  const m = await c("x", 900 * 101, 900 * 105 + 30, async (from) => (froms.push(from), []));
  assert.equal(m.has(100), false);
  assert.equal(m.has(105), false); // re-read, empty now
  await c("x", 900 * 102, 900 * 105 + 61, async (from) => (froms.push(from), []));
  assert.deepEqual(froms, [900 * 100, 900 * 104, 900 * 102]);
});

test("an earlier start than loaded so far reads everything again", async () => {
  const c = bucketCache(step, 3_600_000);
  const froms: number[] = [];
  await c("k", 900 * 50, 900 * 60, async (from) => (froms.push(from), []));
  await c("k", 900 * 40, 900 * 60, async (from) => (froms.push(from), []));
  assert.deepEqual(froms, [900 * 50, 900 * 40]);
});
