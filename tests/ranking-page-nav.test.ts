// A ranking's admin page: the jump bar to its cards (Settings, Servers in
// this ranking, Values of this ranking, Bots, VAC block, Scheduled reset,
// Maintenance) is easy to see and stays at the top while scrolling.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const page = readFileSync("src/app/admin/(panel)/rankings/[code]/page.tsx", "utf8");
const nav = readFileSync("src/components/admin/page-nav.tsx", "utf8");
const css = readFileSync("src/app/admin/admin.css", "utf8");

test("every card of the page has an entry with an icon, level 100 parts only for level 100", () => {
  for (const [id, icon] of [["settings", "gear"], ["servers", "server"], ["values", "list"], ["bots", "players"], ["vac", "shield"], ["hall-of-fame", "clock"], ["maintenance", "reset"]]) {
    assert.match(page, new RegExp(`\\["${id}", u\\.[A-Za-z]+, "${icon}"\\]`), id);
  }
  assert.match(page, /\.\.\.\(isAdmin\s*\?\s*\(\[\s*\["settings"/);
  // A template has no scheduled reset, so no entry for it.
  assert.match(page, /\.\.\.\(template \? \[\] : \[\["hall-of-fame"/);
  assert.match(page, /<PageNav label=\{u\.onThisPage\} parts=\{parts\} \/>/);
});

test("the bar stays below the top bar and marks the card in view", () => {
  assert.match(css, /\.page-nav \{ position: sticky; top: 56px;/);
  assert.match(css, /\.page-nav a\.on \{/);
  // On a phone one row that scrolls sideways, below the 52 px top bar.
  assert.match(css, /\.page-nav \{ top: 52px; flex-wrap: nowrap; overflow-x: auto;/);
  assert.match(nav, /new IntersectionObserver\(/);
  assert.match(nav, /aria-current=\{on === id \? "location" : undefined\}/);
  // Plain links: they jump without JavaScript too.
  assert.match(nav, /href=\{`#\$\{id\}`\}/);
});
