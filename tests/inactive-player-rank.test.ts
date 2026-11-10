// A player the collector moved to hlstats_PlayersInactive has no place in the
// ranking: getPlayer marks them inactive, and the profile, banner and API skip
// the place for them. Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const src = (path: string) => readFileSync(path, "utf8");

test("getPlayer marks a player from hlstats_PlayersInactive as inactive", () => {
  assert.match(src("src/lib/data.ts"), /return \{ \.\.\.row, inactive: table === "hlstats_PlayersInactive" \}/);
});

test("profile, banner and API give an inactive player no place", () => {
  const sites: [string, number][] = [
    ["src/app/(site)/[game]/players/[id]/page.tsx", 2],
    ["src/lib/banners/player-banner.tsx", 1],
    ["src/app/api/v1/players/[id]/route.ts", 1],
  ];
  for (const [path, n] of sites) {
    const s = src(path);
    const calls = s.match(/getPlayerPosition\(/g)?.length ?? 0;
    const guarded = s.match(/hideranking\)? \|\| p\.inactive \? Promise\.resolve\(null\) : getPlayerPosition\(/g)?.length ?? 0;
    assert.equal(calls, n, `${path}: getPlayerPosition calls`);
    assert.equal(guarded, n, `${path}: calls skipped for an inactive player`);
  }
  assert.match(src("src/app/(site)/[game]/players/[id]/page.tsx"), /p\.hideranking \|\| p\.inactive \? <i className="muted">\{t\.notListed\}<\/i>/);
});
