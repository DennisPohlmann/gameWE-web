// Fitting banner texts with Inter bold's widths.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { fitText, textWidth } from "../src/lib/banners/text-width.ts";

test("widths come from the font: W is wider than i, unknown characters count 0.7 em", () => {
  assert.ok(textWidth("W", 10) > 3 * textWidth("i", 10));
  assert.equal(textWidth("Ж", 10), 7);
  assert.equal(textWidth("ab", 10, 1), textWidth("ab", 10) + 2);
});

test("fitText keeps the size while the text fits, shrinks it, then shortens it with …", () => {
  const name = "{RATS 24/7 | GERMANY RELOADED}™";
  assert.deepEqual(fitText(name, 1000, 13, 10), { text: name, size: 13 });
  const smaller = fitText(name, textWidth(name, 11), 13, 10);
  assert.equal(smaller.text, name);
  assert.equal(smaller.size, 11);
  const cut = fitText(name, 100, 13, 10);
  assert.equal(cut.size, 10);
  assert.ok(cut.text.endsWith("…") && textWidth(cut.text, 10) <= 100 && name.startsWith(cut.text.slice(0, -1)));
});
