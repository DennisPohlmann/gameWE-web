// The section links of a ranking prefetch on intent only (pointer, touch,
// focus), not every one of them on every page view (src/components/nav.tsx).
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("section links prefetch on pointer, touch and focus only", () => {
  const s = readFileSync("src/components/nav.tsx", "utf8");
  assert.match(s, /prefetch=\{false\}/);
  for (const ev of ["onPointerEnter", "onTouchStart", "onFocus"]) assert.match(s, new RegExp(`${ev}=\\{\\(\\) => router\\.prefetch\\(href\\)\\}`), ev);
});

test("a ranking and the site have a loading state", () => {
  for (const f of ["src/app/(site)/loading.tsx", "src/app/(site)/[game]/loading.tsx"]) assert.match(readFileSync(f, "utf8"), /<Skeleton rows=\{12\} \/>/, f);
});
