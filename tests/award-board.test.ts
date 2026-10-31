// Daily awards: a stored day without a winner (winner_id NULL, count 0, as
// HLstatsX:CE stores it) is "Not awarded", not "#null (0 kills)"; the board's
// columns are even. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const awards = readFileSync("src/lib/awards.ts", "utf8");
const board = readFileSync("src/components/award-board.tsx", "utf8");
const css = readFileSync("src/app/(site)/globals.css", "utf8");

test("stored days skip rows without a winner", () => {
  assert.match(awards, /h\.winner_id IS NOT NULL AND h\.winner_id > 0 AND h\.winner_count > 0/);
});

test("the board has fixed, even columns", () => {
  assert.match(board, /<table className="award-table">/);
  assert.match(board, /<col className="award-col" \/>/);
  assert.match(css, /table\.award-table \{ table-layout: fixed; \}/);
});
