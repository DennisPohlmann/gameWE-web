// The drop-downs of the admin header and side menu (user menu, ranking
// picker) are MenuDetails (src/components/admin/menu-details.tsx): the layout
// stays mounted across pages, so a plain <details> stayed open. Run with
// `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const menu = readFileSync("src/components/admin/menu-details.tsx", "utf8");
const layout = readFileSync("src/app/admin/(panel)/layout.tsx", "utf8");
const nav = readFileSync("src/components/admin/nav.tsx", "utf8");

test("the user menu and the ranking picker are MenuDetails, no plain <details>", () => {
  assert.match(layout, /<MenuDetails className="adm-user">[\s\S]*<\/MenuDetails>/);
  assert.match(nav, /<MenuDetails className="adm-picker">/);
  assert.doesNotMatch(layout, /<details className="adm-user"/);
});

test("MenuDetails closes outside, on Escape, on its items and on a page change", () => {
  assert.match(menu, /addEventListener\("pointerdown", outside\)/);
  assert.match(menu, /!d\.contains\(e\.target as Node\)\) d\.open = false/);
  assert.match(menu, /e\.key !== "Escape"[\s\S]*d\.open = false;\s*d\.querySelector\("summary"\)\?\.focus\(\)/);
  assert.match(menu, /closest\("a, button"\)/);
  assert.match(menu, /ref\.current\.open = false;\s*\}, \[pathname\]\)/);
  // The listeners go again when the menu unmounts.
  assert.match(menu, /removeEventListener\("pointerdown", outside\)/);
  assert.match(menu, /removeEventListener\("keydown", escape\)/);
});
