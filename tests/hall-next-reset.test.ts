// Hall of fame page: a small note at the end says when the running period
// ends (the next reset), only while one is scheduled. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { effectiveSchedule, parseNext } from "../src/lib/job-plan.ts";
import { nextStart } from "../src/lib/hall-period.ts";

const lib = readFileSync("src/lib/hall-of-fame.ts", "utf8");
const page = readFileSync("src/app/(site)/[game]/hall-of-fame/page.tsx", "utf8");

test("the note uses the ranking's schedule, own or for all rankings, never a template's", () => {
  const fn = lib.slice(lib.indexOf("export async function nextHallReset"), lib.indexOf("export function invalidateHallOfFame"));
  // Public pages read with the SELECT-only user.
  assert.match(fn, /\bquery</);
  assert.doesNotMatch(fn, /adminQuery|adminExec/);
  assert.match(fn, /if \(!Number\(servers\[0\]\?\.n \?\? 0\)\) return null;/);
  assert.match(fn, /effectiveSchedule\(o\.get\(keys\[0\]\), o\.get\(keys\[1\]\)\)/);
  // The collector's end of the period first, else the day from its start.
  assert.match(fn, /const at = parseNext\(o\.get\(keys\[2\]\)\);\s*\n\s*if \(at\) return \{ at \};/);
  assert.match(fn, /return last \? \{ day: nextStart\(last, schedule\) \} : null;/);
  assert.equal(effectiveSchedule("off", "quarter"), null);
  assert.equal(effectiveSchedule("", ""), null);
  assert.deepEqual(effectiveSchedule("", "month"), { unit: "month", every: 1, day: 1, month: 1 });
  assert.equal(parseNext("abc"), 0);
  assert.equal(nextStart(Date.UTC(2026, 9, 1) / 1000, { unit: "month", every: 1 }), "2026-11-01");
});

test("the page shows it only when there is a next reset, at its end", () => {
  assert.match(page, /const \[rows, next\] = await Promise\.all\(\[getHallOfFame\(game\), nextHallReset\(game\)\]\);/);
  assert.match(page, /\{next \? \(\s*\n\s*<p className="muted hof-next">/);
  // After the periods: the last element of the page.
  assert.ok(page.indexOf('className="muted hof-next"') > page.indexOf("t.hofEmpty"));
  for (const lang of ["en", "de"]) {
    const d = JSON.parse(readFileSync(`src/translations/${lang}.json`, "utf8"));
    assert.match(d.hofNextReset, /\{d\}/, lang);
  }
});
