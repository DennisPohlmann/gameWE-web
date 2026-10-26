// Career rank and the way to the next one (rank column of the player tables).
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { rankFor, rankStep, type Rank } from "../src/lib/career.ts";
import { rankingSorts, sortParam } from "../src/lib/sorts.ts";

const ranks: Rank[] = [
  { index: 0, name: "{LANG_RANG_PVT}", minimum: 10, next: 50 },
  { index: 1, name: "{LANG_RANG_PVC}", minimum: 50, next: 150 },
  { index: 2, name: "{LANG_RANG_CPL}", minimum: 150, next: null },
];

test("below the first rank there is no rank, the way leads to the first one", () => {
  assert.equal(rankFor(4, ranks), undefined);
  assert.deepEqual(rankStep(4, ranks), { next: ranks[0], needed: 6, share: 0.4 });
});

test("inside a rank the way runs from its minimum to the next rank", () => {
  assert.equal(rankFor(50, ranks)?.index, 1);
  assert.deepEqual(rankStep(50, ranks), { next: ranks[2], needed: 100, share: 0 });
  assert.deepEqual(rankStep(125, ranks), { next: ranks[2], needed: 25, share: 0.75 });
});

test("the highest rank has no next step, no ranks no step either", () => {
  assert.equal(rankFor(9999, ranks)?.index, 2);
  assert.equal(rankStep(9999, ranks), null);
  assert.equal(rankStep(5, []), null);
});

test("the rank column sorts by kills, the base of the career ranks", () => {
  assert.equal(sortParam(rankingSorts, "career", "skill"), "career");
  assert.equal(rankingSorts.career, "p.kills");
});
