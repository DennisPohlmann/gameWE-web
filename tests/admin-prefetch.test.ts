// Admin links do not prefetch (src/app/admin, src/components/admin): every
// admin page has dozens of links, and each prefetch is a server render through
// the admin pool of 3 connections (measured: 33-40 prefetches per page view,
// clicks waited up to 197 ms behind them). Run with `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

test("every admin <Link> has prefetch={false}", () => {
  let links = 0;
  for (const f of [...files("src/app/admin"), ...files("src/components/admin")]) {
    for (const m of readFileSync(f, "utf8").matchAll(/<Link\b[^>]*/g)) {
      links++;
      assert.match(m[0], /prefetch=\{false\}/, `${f}: ${m[0].slice(0, 80)}`);
    }
  }
  assert.ok(links > 40, `found ${links} links`);
});
