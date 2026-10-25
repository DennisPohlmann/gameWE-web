// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// The area polygons under chart lines stay invisible unless a template fills
// them: the base rule must outrank the series colour rules (.chart .sN,
// .chart .srvN set stroke and fill), and no base rule may paint an area.
test("chart areas are hidden in the base stylesheet", () => {
  const css = readFileSync("src/app/globals.css", "utf8");
  assert.match(css, /\.chart polygon\.area, \.load-chart polygon\.area-players \{ fill: none; stroke: none;/);
  for (const m of css.matchAll(/([^{}]*)\{([^}]*)\}/g)) {
    const [sel, body] = [m[1].trim(), m[2]];
    if (/\.area\b|\.area-players\b/.test(sel)) assert.doesNotMatch(body, /(?:fill|stroke):\s*(?!\s|none)/, sel);
  }
});
