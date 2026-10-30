// Admin > Rankings: a switch at the top shows the rankings with servers or
// the templates (rankings without servers), not both in one list.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/app/admin/(panel)/rankings/page.tsx", "utf8");
const i18n = readFileSync("src/lib/admin-i18n.ts", "utf8");

test("one list at a time, chosen by ?view=templates", () => {
  assert.match(page, /const templates = sp\.view === "templates";/);
  assert.match(page, /const active = all\.filter\(\(r\) => r\.servers > 0\);/);
  assert.match(page, /const spare = all\.filter\(\(r\) => r\.servers === 0\);/);
  assert.match(page, /const rankings = templates \? spare : active;/);
  // Both choices, with their counts, the current one marked.
  assert.match(page, /href="\/admin\/rankings" className=\{templates \? undefined : "on"\}/);
  assert.match(page, /href="\/admin\/rankings\?view=templates" className=\{templates \? "on" : undefined\}/);
  assert.match(page, /nf\(active\.length\)/);
  assert.match(page, /nf\(spare\.length\)/);
  // An empty list says so instead of an empty table.
  assert.match(page, /templates \? u\.noTemplates : u\.noActiveRankings/);
});

test("the texts are in German and English", () => {
  for (const k of ["viewRankings", "viewTemplates", "viewChoose", "noActiveRankings", "noTemplates"]) {
    assert.equal(i18n.match(new RegExp(`\\n    ${k}: "`, "g"))?.length, 2, k);
  }
});
