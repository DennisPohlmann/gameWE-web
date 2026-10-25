// Profile radar: which axes are drawn and how values become radii. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { axisRatio, axisValue, FIXED_MAX, RADAR_KEYS, RADAR_MIN_PLAYERS, radarPoints, type AxisRank, type PlayerRatios, type RadarKey } from "../src/lib/radar.ts";

// A CS:GO-like player: all five stats filled.
function full(): PlayerRatios {
  return {
    kpd: { total: { num: 300, den: 200 }, current: { num: 30, den: 10 } },
    kpm: { total: { num: 300, den: 36000 }, current: { num: 30, den: 1800 } },
    assists: { total: { num: 60, den: 300 }, current: { num: 3, den: 30 } },
    survived: { total: { num: 40, den: 100 }, current: { num: 5, den: 10 } },
    wins: { total: { num: 55, den: 100 }, current: { num: 4, den: 10 } },
  };
}

function ranks(over: Partial<Record<RadarKey, Partial<AxisRank>>> = {}): Record<RadarKey, AxisRank> {
  return Object.fromEntries(
    RADAR_KEYS.map((k) => [k, { n: 100, nonZero: 90, belowTotal: 78, belowCurrent: 50, ...over[k] }]),
  ) as Record<RadarKey, AxisRank>;
}

test("values are the shown ratios", () => {
  assert.equal(axisValue("kpd", { num: 300, den: 200 }), 1.5);
  assert.equal(axisValue("kpm", { num: 300, den: 36000 }), 0.5); // per minute, from seconds
  assert.equal(axisValue("assists", { num: 60, den: 300 }), 0.2); // per kill, not the count
  assert.equal(axisValue("wins", { num: 55, den: 100 }), 0.55);
});

test("K/D counts no deaths as one, like the rest of the site", () => {
  assert.deepEqual(axisRatio("kpd", { num: 7, den: 0 }), { num: 7, den: 1 });
  assert.equal(axisRatio("kpd", { num: 0, den: 0 }), null);
});

test("nothing to divide by: no value", () => {
  assert.equal(axisValue("survived", { num: 0, den: 0 }), null);
  assert.equal(axisValue("kpm", { num: 5, den: 0 }), null);
  assert.equal(axisValue("assists", { num: 3, den: 0 }), null);
  assert.equal(axisValue("wins", null), null);
});

test("radius is the percentile among the game's players", () => {
  const pts = radarPoints(full(), ranks());
  assert.deepEqual(pts.map((p) => p.key), [...RADAR_KEYS]);
  for (const p of pts) {
    assert.equal(p.rTotal, 0.78);
    assert.equal(p.pctTotal, 0.78);
    assert.equal(p.rCurrent, 0.5);
  }
});

test("axes the game does not record are left out, not drawn at zero", () => {
  // CS:S: no assists are logged, so no player has one.
  const r = full();
  r.assists = { total: { num: 0, den: 300 }, current: { num: 0, den: 30 } };
  const pts = radarPoints(r, ranks({ assists: { nonZero: 0, belowTotal: 0, belowCurrent: 0 } }));
  assert.deepEqual(pts.map((p) => p.key), ["kpd", "kpm", "survived", "wins"]);
});

test("a player without rounds keeps the round axes, without data", () => {
  const r = full();
  r.survived = { total: { num: 0, den: 0 }, current: null };
  r.wins = { total: { num: 0, den: 0 }, current: null };
  const pts = radarPoints(r, ranks());
  assert.deepEqual(pts.map((p) => p.key), [...RADAR_KEYS]);
  assert.deepEqual(pts.map((p) => p.noData), [false, false, false, true, true]);
  const wins = pts.find((p) => p.key === "wins");
  assert.equal(wins?.rTotal, 0);
  assert.equal(wins?.rCurrent, null);
});

test("never fewer than three axes: no rounds and no assists logged", () => {
  // CS:S player with kills but no rounds: before, only K/D and kills per
  // minute were left and the chart turned into a list.
  const r: PlayerRatios = {
    kpd: { total: { num: 22, den: 9 }, current: { num: 22, den: 9 } },
    kpm: { total: { num: 22, den: 154 }, current: { num: 22, den: 154 } },
    assists: { total: { num: 0, den: 22 }, current: { num: 0, den: 22 } },
    survived: { total: { num: 0, den: 0 }, current: { num: 0, den: 0 } },
    wins: { total: { num: 0, den: 0 }, current: { num: 0, den: 0 } },
  };
  const pts = radarPoints(r, ranks({ assists: { nonZero: 0 } }));
  assert.deepEqual(pts.map((p) => p.key), ["kpd", "kpm", "survived", "wins"]);
  assert.deepEqual(pts.map((p) => p.noData), [false, false, true, true]);
  // Nothing at all for the player but K/D: the unrecorded axis fills up.
  const r2 = { ...r, kpm: { total: { num: 22, den: 0 }, current: null } };
  const p2 = radarPoints(r2, ranks({ assists: { nonZero: 0 }, survived: { nonZero: 0 }, wins: { nonZero: 0 } }));
  assert.ok(p2.length >= 3);
  assert.deepEqual(p2.filter((p) => !p.noData).map((p) => p.key), ["kpd"]);
});

test("a real zero stays when the game records the stat", () => {
  const r = full();
  r.wins = { total: { num: 0, den: 20 }, current: null };
  const pts = radarPoints(r, ranks({ wins: { belowTotal: 0 } }));
  const wins = pts.find((p) => p.key === "wins");
  assert.ok(wins);
  assert.equal(wins.rTotal, 0);
  assert.equal(wins.current, null);
  assert.equal(wins.rCurrent, null);
});

test("too few players to compare: fixed scale", () => {
  const pts = radarPoints(full(), ranks(Object.fromEntries(RADAR_KEYS.map((k) => [k, { n: RADAR_MIN_PLAYERS - 1 }]))));
  const kpd = pts.find((p) => p.key === "kpd");
  assert.ok(kpd);
  assert.equal(kpd.pctTotal, null);
  assert.equal(kpd.rTotal, 1.5 / FIXED_MAX.kpd);
  assert.equal(kpd.rCurrent, 1); // 3.0 is the top of the scale
  const wins = pts.find((p) => p.key === "wins");
  assert.equal(wins?.rTotal, 0.55);
});

test("radii stay inside 0..1", () => {
  const r = full();
  r.kpd = { total: { num: 900, den: 10 }, current: null };
  const pts = radarPoints(r, ranks({ kpd: { n: 2, belowTotal: 5 } }));
  assert.equal(pts[0].rTotal, 1);
  const p2 = radarPoints(full(), ranks({ kpd: { n: 10, belowTotal: 50 } }));
  assert.equal(p2[0].rTotal, 1);
});
