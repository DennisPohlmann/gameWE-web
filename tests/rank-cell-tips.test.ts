// The rank badges of a ranking table are plain server markup with the kills
// in data-rank-tip; one detail box per table draws the details
// (src/components/rank-cell-tips.tsx), not one client component per row.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (f: string) => readFileSync(f, "utf8");

test("a rank cell is a server-rendered button with the kills, no hidden details", () => {
  const s = read("src/components/rank-cell.tsx");
  assert.doesNotMatch(s, /"use client"|RankTips|hidden/);
  assert.match(s, /<button type="button" className="rank-tip-btn" data-rank-tip=\{kills\}>/);
});

test("one box per ranking table, answering only for badges in its own table box", () => {
  const ranking = read("src/components/ranking.tsx");
  assert.equal(ranking.match(/<RankCellTips\b/g)?.length, 1);
  const s = read("src/components/rank-cell-tips.tsx");
  assert.match(s, /^"use client";/);
  assert.match(s, /const box = anchor\.current\?\.parentElement;\s*return btn && box\?\.contains\(btn\) \? btn : null;/);
  for (const ev of ["pointerover", "pointerout", "pointerdown", "click", "focusin", "focusout", "keydown"]) {
    assert.match(s, new RegExp(`document\\.addEventListener\\("${ev}"`), ev);
    assert.match(s, new RegExp(`document\\.removeEventListener\\("${ev}"`), ev);
  }
  assert.match(s, /role="tooltip"/);
  assert.doesNotMatch(s, /innerHTML/);
});
