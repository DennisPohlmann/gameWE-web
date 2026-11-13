// Arabic pages show dates left to right as one isolated run, without the
// right-to-left marks of the locale; other languages are untouched.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { dateFormat, fmtDateTime, localeOf, ltrDate } from "../src/lib/format.ts";

const at = Date.UTC(2026, 10, 13, 8, 5) / 1000;

test("Arabic dates are an LTR isolate without RTL marks", () => {
  const s = fmtDateTime(at, "ar", "UTC");
  assert.match(s, /^⁦[^‎‏؜⁦⁩]+⁩$/);
  assert.ok(s.includes("13/11/2026"), s);
  const tip = dateFormat(localeOf("ar"), { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(at * 1000);
  assert.ok(tip.startsWith("⁦") && tip.endsWith("⁩"), tip);
});

test("other languages keep the plain locale text", () => {
  assert.equal(fmtDateTime(at, "de", "UTC"), "13.11.2026, 08:05");
  assert.equal(ltrDate(localeOf("en"), "2026-11-13 08:05"), "2026-11-13 08:05");
  assert.equal(ltrDate(undefined, "x"), "x");
});
