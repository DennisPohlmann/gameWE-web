// Values of numbers only read left to right on right-to-left pages (ltrNumbers).
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtNum, fmtPct, numbersOnly } from "../src/lib/format.ts";

test("number pairs count as numbers only", () => {
  assert.ok(numbersOnly(`${fmtNum(5081, "ar")} (${fmtPct(0.27, "ar")})`));
  assert.ok(numbersOnly("827 / 829"));
  assert.ok(numbersOnly("5,081 (193*)"));
});

test("text, empty values and elements keep the page's direction", () => {
  assert.ok(!numbersOnly("12d 16:47h"));
  assert.ok(!numbersOnly("27 % من القتلات"));
  assert.ok(!numbersOnly("de_dust2"));
  assert.ok(!numbersOnly("-"));
  assert.ok(!numbersOnly(""));
  assert.ok(!numbersOnly(42));
  assert.ok(!numbersOnly(null));
});

test("percentages are one left-to-right run on right-to-left pages only", () => {
  assert.equal(fmtPct(0.27, "ar"), "⁦27 %⁩");
  assert.equal(fmtPct(0.27, "en"), "27 %");
  assert.equal(fmtPct(null, "ar"), "-");
});
