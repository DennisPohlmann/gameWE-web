// The skin preview cookie of screenshot runs (src/lib/skin-preview.ts). Run
// with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { previewSkinOf } from "../src/lib/skin-preview.ts";

test("the cookie counts only with SKIN_PREVIEW=on", () => {
  assert.equal(previewSkinOf("modern-orange", "on"), "modern-orange");
  assert.equal(previewSkinOf("modern-orange", " on "), "modern-orange");
  for (const off of [undefined, "", "off", "1", "true", "ON"]) assert.equal(previewSkinOf("modern-orange", off), null);
});

test("only a template id is taken from the cookie", () => {
  assert.equal(previewSkinOf(undefined, "on"), null);
  for (const bad of ["", "../dark", "Dark", "dark/x", "-dark", "a".repeat(33), "dark.css", "dark\u0000"]) assert.equal(previewSkinOf(bad, "on"), null, bad);
});
