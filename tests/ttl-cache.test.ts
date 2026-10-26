// The cache of the slow aggregate queries: fresh values are reused, stale
// ones are returned at once while one reload runs, failed loads are not
// kept. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ttlCache } from "../src/lib/ttl-cache.ts";

const tick = () => new Promise((r) => setTimeout(r, 5));

test("a fresh value is loaded once", async () => {
  const c = ttlCache<number>(60_000);
  let n = 0;
  assert.equal(await c("a", async () => ++n), 1);
  assert.equal(await c("a", async () => ++n), 1);
  assert.equal(await c("b", async () => ++n), 2);
});

test("a stale value comes at once, one reload runs in the background", async () => {
  const c = ttlCache<number>(1, 60_000);
  let n = 0;
  assert.equal(await c("a", async () => ++n), 1);
  await tick();
  // Two visitors at the same time: both get the old value, one reload.
  const [x, y] = await Promise.all([c("a", async () => ++n), c("a", async () => ++n)]);
  assert.deepEqual([x, y], [1, 1]);
  await tick();
  assert.equal(n, 2);
  assert.equal(await c("a", async () => ++n), 2);
});

test("a failed load is not kept", async () => {
  const c = ttlCache<number>(60_000);
  await assert.rejects(c("a", async () => Promise.reject(new Error("db"))));
  await tick();
  assert.equal(await c("a", async () => 7), 7);
});
