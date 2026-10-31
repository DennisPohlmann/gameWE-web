// The ranking picker in the admin side menu (src/components/admin/nav.tsx):
// choosing a ranking closes the list, also when it is the one shown, and a
// click does not select the text of the list. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const nav = readFileSync("src/components/admin/nav.tsx", "utf8");
const css = readFileSync("src/app/admin/admin.css", "utf8");

test("every link of the ranking picker closes it", () => {
  const list = nav.slice(nav.indexOf('<div className="adm-picker-list"'), nav.indexOf("</details>"));
  const links = list.match(/<Link\b[^>]*>/g) ?? [];
  assert.equal(links.length, 2, "the 'all rankings' link and one per ranking");
  for (const l of links) assert.match(l, /onClick=\{closePicker\}/);
  assert.match(nav, /<details className="adm-picker" ref=\{picker\}>/);
});

test("the picker also closes after every navigation", () => {
  const effect = nav.slice(nav.indexOf("useEffect(() => {"), nav.indexOf("}, [pathname, game]);"));
  assert.match(effect, /picker\.current\.open = false/);
});

test("clicks in the picker do not select its text", () => {
  assert.match(css, /\.adm-picker summary \{[^}]*user-select: none/);
  assert.match(css, /\.adm-picker-list a \{[^}]*user-select: none/);
});
