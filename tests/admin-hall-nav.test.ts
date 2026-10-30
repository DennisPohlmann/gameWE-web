// Admin: a ranking's hall of fame page (its entries, link to the schedule)
// is in the menu of the ranking and reachable before the first reset.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const nav = readFileSync("src/components/admin/nav.tsx", "utf8");

test("the ranking's menu has the hall of fame, for level 100 and rankings with servers", () => {
  assert.match(nav, /\{current && isAdmin && current\.servers > 0 \? \(\s*\n\s*<Item\s*\n\s*href=\{`\/admin\/rankings\/\$\{encodeURIComponent\(current\.code\)\}\/hall-of-fame`\}/);
  assert.match(nav, /label=\{t\.navHallOfFame\}/);
  assert.match(nav, /on=\{seg === "rankings" && parts\[2\] === current\.code && parts\[3\] === "hall-of-fame"\}/);
  // The overview is not marked on the hall of fame page.
  assert.match(nav, /on=\{seg === "rankings" && parts\[2\] === current\.code && !parts\[3\]\}/);
  const i18n = readFileSync("src/lib/admin-i18n.ts", "utf8");
  assert.equal(i18n.match(/\n    navHallOfFame: "/g)?.length, 2);
});

test("the card links to the page also without entries, the page stays level 100", () => {
  const card = readFileSync("src/app/admin/(panel)/rankings/[code]/hall-of-fame-card.tsx", "utf8");
  assert.doesNotMatch(card, /\{s\.entries \? \(\s*\n\s*<Link className="more" href=\{`\/admin\/rankings\/\$\{encodeURIComponent\(game\)\}\/hall-of-fame`\}/);
  assert.match(card, /<Link className="more" href=\{`\/admin\/rankings\/\$\{encodeURIComponent\(game\)\}\/hall-of-fame`\}>/);
  const page = readFileSync("src/app/admin/(panel)/rankings/[code]/hall-of-fame/page.tsx", "utf8");
  assert.match(page, /await requireAdmin\(LEVEL_ADMIN\);/);
  assert.match(page, /\{!periods\.length \? <p className="muted">\{t\.empty\}<\/p> : null\}/);
});
