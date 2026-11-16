// The ranking picker in the admin side menu (src/components/admin/nav.tsx):
// it is a MenuDetails (tests/admin-menu-details.test.ts), and a click does
// not select the text of the list. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const nav = readFileSync("src/components/admin/nav.tsx", "utf8");
const css = readFileSync("src/app/admin/admin.css", "utf8");

test("the ranking picker is a MenuDetails, which closes on its links and on every page change", () => {
  assert.match(nav, /<MenuDetails className="adm-picker">/);
  const list = nav.slice(nav.indexOf('<div className="adm-picker-list"'), nav.indexOf("</MenuDetails>"));
  assert.equal((list.match(/<Link\b[^>]*>/g) ?? []).length, 2, "the 'all rankings' link and one per ranking");
});

test("clicks in the picker do not select its text", () => {
  assert.match(css, /\.adm-picker summary \{[^}]*user-select: none/);
  assert.match(css, /\.adm-picker-list a \{[^}]*user-select: none/);
});
