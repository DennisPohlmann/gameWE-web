// Background lines of the start page's "General statistics" cards.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SPARK_H, sparkPaths, sparkSeries } from "../src/lib/sparkline.ts";

test("the series runs from its first to its last value", () => {
  assert.deepEqual(sparkSeries([null, null, 3, null, 5]), [3, null, 5]);
  assert.deepEqual(sparkSeries([null, 3, null, 5, null, null]), [3, null, 5]);
  assert.deepEqual(sparkSeries([null, null]), []);
  assert.deepEqual(sparkSeries([]), []);
});

test("long series are averaged into at most max buckets", () => {
  assert.deepEqual(sparkSeries([1, 3, 5, 7, 9, 11], 3), [2, 6, 10]);
  // A bucket of only gaps stays a gap, partly empty buckets average their numbers.
  assert.deepEqual(sparkSeries([2, 4, null, null, 6, null], 3), [3, null, 6]);
  assert.equal(sparkSeries(Array.from({ length: 2881 }, (_, i) => i), 90).length <= 90, true);
});

test("fewer than two values draw no line", () => {
  assert.equal(sparkPaths([]), null);
  assert.equal(sparkPaths([5]), null);
  assert.equal(sparkPaths([5, null]), null);
});

test("the line runs from 0 at the bottom to the highest value at the top", () => {
  const p = sparkPaths([0, 10]);
  assert.ok(p);
  assert.equal(p.line, `M0 ${SPARK_H}L100 2`);
  assert.equal(p.area, `M0 ${SPARK_H}L0 ${SPARK_H}L100 2L100 ${SPARK_H}Z`);
});

test("all zero: a flat line at the bottom", () => {
  const p = sparkPaths([0, 0, 0]);
  assert.ok(p);
  assert.equal(p.line, `M0 ${SPARK_H - 0.5}L50 ${SPARK_H - 0.5}L100 ${SPARK_H - 0.5}`);
});

test("a gap breaks the line", () => {
  const p = sparkPaths([4, 4, null, 2, 2]);
  assert.ok(p);
  assert.equal(p.line.match(/M/g)?.length, 2);
  assert.equal(p.area.match(/Z/g)?.length, 2);
  // Negative values (none expected) stay at the bottom.
  assert.ok(sparkPaths([-5, 5])?.line.startsWith(`M0 ${SPARK_H}`));
});
