// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { steadyFps } from "../src/lib/fps.ts";

test("a single low FPS sample takes its neighbours' value", () => {
  assert.deepEqual(steadyFps([100, 100, 31, 100, 100]), [100, 100, 100, 100, 100]);
  assert.deepEqual(steadyFps([100, 31, 99]), [100, 99, 99]);
});

test("a longer drop, unknown samples and the ends stay", () => {
  assert.deepEqual(steadyFps([100, 31, 30, 100]), [100, 31, 31, 100]);
  assert.deepEqual(steadyFps([100, 0, 100]), [100, 0, 100]);
  assert.deepEqual(steadyFps([0, 31, 100]), [0, 31, 100]);
  assert.deepEqual(steadyFps([31, 100, 100, 31]), [31, 100, 100, 31]);
});
