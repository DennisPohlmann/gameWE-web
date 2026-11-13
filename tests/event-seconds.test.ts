// Event and chat times show seconds; other date-times keep hours and minutes.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fmtDateTime, fmtEventTime } from "../src/lib/format.ts";
import { LANGUAGES } from "../src/translations/languages.ts";

const at = Date.UTC(2026, 10, 13, 20, 13, 7) / 1000;

test("event times carry seconds", () => {
  assert.equal(fmtEventTime(at, "de", "UTC"), "13.11.2026, 20:13:07");
  assert.equal(fmtEventTime(at, "en", "UTC"), "13 Nov 2026, 20:13:07");
  assert.equal(fmtDateTime(at, "de", "UTC"), "13.11.2026, 20:13");
  assert.equal(fmtEventTime(0, "de"), "-");
});

test("Arabic event times stay an LTR isolate, date before time, with seconds", () => {
  const s = fmtEventTime(at, "ar", "UTC");
  assert.match(s, /^⁦[^‎‏؜⁦⁩]+⁩$/);
  assert.ok(s.indexOf("13/11/2026") >= 0 && s.indexOf("13/11/2026") < s.search(/\d+:13:07/), s);
});

test("every language shows the seconds", () => {
  for (const l of LANGUAGES) {
    const s = fmtEventTime(at, l.code, "UTC");
    assert.match(s.replace(/[^\d:.]/g, " "), /13[:.]07\b/, `${l.code}: ${s}`);
  }
});
