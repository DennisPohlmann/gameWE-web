// One order of the ranking everywhere: points, then kills, then fewer deaths,
// then the lower player id; places run on, and a player without a kill and
// a death has no place (rank-order.ts). Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { hasPlace, placesFrom, rankCompare, rankOrderSql, type RankKey } from "../src/lib/rank-order.ts";

const p = (playerId: number, skill: number, kills: number, deaths: number): RankKey => ({ playerId, skill, kills, deaths });

// The places as the database would give them: every placed player sorted.
function bruteForce(all: RankKey[]): Map<number, number> {
  const sorted = all.filter(hasPlace).sort(rankCompare);
  return new Map(sorted.map((x, i) => [x.playerId, i + 1]));
}

// What rankPositions reads for `shown` (see data.ts), computed from `all`.
function counted(all: RankKey[], shown: RankKey[]): Map<number, number> {
  const placed = all.filter(hasPlace);
  const skills = [...new Set(shown.filter(hasPlace).map((x) => x.skill))];
  const top = Math.max(...skills);
  const low = Math.min(...skills);
  const above = placed.filter((x) => x.skill > top).length;
  const band = new Map<number, number>();
  for (const x of placed) if (x.skill > low && x.skill <= top) band.set(x.skill, (band.get(x.skill) ?? 0) + 1);
  const same = placed.filter((x) => skills.includes(x.skill));
  return placesFrom(shown, above, [...band].map(([skill, n]) => ({ skill, n })), same);
}

test("ties: points, then kills, then fewer deaths, then the older player", () => {
  const all = [p(5, 1200, 10, 4), p(3, 1200, 10, 4), p(9, 1200, 12, 9), p(2, 1200, 10, 2), p(7, 1300, 1, 1), p(8, 900, 0, 1)];
  const order = [...all].sort(rankCompare).map((x) => x.playerId);
  assert.deepEqual(order, [7, 9, 2, 3, 5, 8]);
  assert.deepEqual([...bruteForce(all)], [[7, 1], [9, 2], [2, 3], [3, 4], [5, 5], [8, 6]]);
});

test("the counted places match the full sort for any page", () => {
  let seed = 7;
  const rnd = (n: number) => ((seed = (seed * 1103515245 + 12345) % 2 ** 31), seed % n);
  const all = Array.from({ length: 400 }, (_, i) => p(i + 1, 990 + rnd(25), rnd(4), rnd(4)));
  const want = bruteForce(all);
  for (let start = 0; start < 400; start += 37) {
    const shown = all.slice(start, start + 50);
    const got = counted(all, shown);
    for (const x of shown) assert.equal(got.get(x.playerId), want.get(x.playerId), `player ${x.playerId}`);
  }
  // No two players share a place.
  assert.equal(new Set(want.values()).size, want.size);
});

test("after a reset everyone has 1000 points and 0/0: nobody has a place", () => {
  const all = Array.from({ length: 20 }, (_, i) => p(i + 1, 1000, 0, 0));
  assert.equal(all.some(hasPlace), false);
  assert.equal(counted(all, all).size, 0);
  // The first kill or death after the reset gives the place.
  all[4] = p(5, 1003, 1, 0);
  all[9] = p(10, 997, 0, 1);
  assert.deepEqual([...counted(all, all)], [[5, 1], [10, 2]]);
});

test("SQL order and its reverse", () => {
  assert.equal(rankOrderSql("p."), "p.skill DESC, p.kills DESC, p.deaths ASC, p.playerId ASC");
  assert.equal(rankOrderSql("", false), "skill ASC, kills ASC, deaths DESC, playerId DESC");
});

test("every list ordered by points uses the order of the ranking", () => {
  const data = readFileSync("src/lib/data.ts", "utf8");
  // No ORDER BY on points alone or with the id as the only tie-breaker; the
  // name search (searchHits) lists matches without places.
  const lists = data.replace(/function searchHits[^]*?\n}\n/, "");
  assert.doesNotMatch(lists, /ORDER BY p?\.?skill DESC(, p?\.?playerId( DESC)?)?( LIMIT|`)/);
  assert.match(data, /const order = opts\.sort === "skill" \? rankOrderSql\("p\.", !opts\.asc\)/);
  // The players without a place come after the others, the "N" counts only placed players.
  assert.match(data, /"p\.kills = 0 AND p\.deaths = 0"/);
  assert.match(data, /getRankedCount[^]*?hideranking = 0 AND \$\{PLACED\}/);
  assert.match(data, /if \(!hasPlace\(p\)\) return null;/);
  assert.match(data, /AND skill > \?\)\s*\+ \(SELECT COUNT\(\*\) \$\{ranked\} AND skill = \? AND \(kills > \? OR kills = \? AND \(deaths < \? OR deaths = \? AND playerId < \?\)\)\)/);
  assert.match(readFileSync("src/components/ranking.tsx", "utf8"), /rank === null \|\| !hasPlace\(r\) \? "-"/);
  assert.match(readFileSync("src/lib/api.ts", "utf8"), /rank: ranked && hasPlace\(r\) \?/);
});
