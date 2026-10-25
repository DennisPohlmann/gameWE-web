// Profile radar: which axes are drawn and how values become radii. Run with
// `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { AVG_RING, axisRatio, axisValue, FIXED_MAX, RADAR_KEYS, radarPoints, type PlayerRatios, type RadarAverage, type RadarKey } from "../src/lib/radar.ts";

// A CS:GO-like player over the last 14 days: all five stats filled.
function full(): PlayerRatios {
  return {
    kpd: { num: 30, den: 10 },
    kpm: { num: 30, den: 1800 },
    assists: { num: 3, den: 30 },
    survived: { num: 5, den: 10 },
    wins: { num: 4, den: 10 },
  };
}

// All active players: K/D 1.5, 0.5 kills/min, 0.2 assists per kill, 40 %
// survived, 50 % won.
function avg(over: Partial<RadarAverage["ratios"]> = {}, players = 100): RadarAverage {
  return {
    players,
    ratios: {
      kpd: { num: 3000, den: 2000 },
      kpm: { num: 3000, den: 360000 },
      assists: { num: 600, den: 3000 },
      survived: { num: 400, den: 1000 },
      wins: { num: 500, den: 1000 },
      ...over,
    },
  };
}

const at = (pts: ReturnType<typeof radarPoints>, key: RadarKey) => {
  const p = pts.find((x) => x.key === key);
  assert.ok(p, key);
  return p;
};
const near = (a: number | null, b: number) => assert.ok(a !== null && Math.abs(a - b) < 1e-9, `${a} != ${b}`);

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

test("the average sits on the middle ring, the player relative to it", () => {
  const pts = radarPoints(full(), avg());
  assert.deepEqual(pts.map((p) => p.key), [...RADAR_KEYS]);
  for (const p of pts) assert.equal(p.rAvg, AVG_RING);
  near(at(pts, "kpd").rel, 2); // 3.0 against 1.5: the outer ring
  assert.equal(at(pts, "kpd").r, 1);
  near(at(pts, "kpm").rel, 2);
  near(at(pts, "assists").rel, 0.5); // 0.1 against 0.2
  near(at(pts, "assists").r, 0.25);
  near(at(pts, "survived").r, 0.625); // 50 % against 40 %
  near(at(pts, "wins").r, 0.4); // 40 % against 50 %
  near(at(pts, "wins").avg, 0.5);
});

test("radii stay inside 0..1: far above the average is the outer ring", () => {
  const r = full();
  r.kpd = { num: 900, den: 10 };
  const pts = radarPoints(r, avg());
  assert.equal(pts[0].r, 1);
  near(pts[0].rel, 60);
});

test("the same values as the average: both on the middle ring", () => {
  const pts = radarPoints(avg().ratios, avg());
  for (const p of pts) {
    assert.equal(p.r, AVG_RING);
    assert.equal(p.rAvg, AVG_RING);
    near(p.rel, 1);
  }
});

test("axes the game does not record are left out, not drawn at zero", () => {
  // CS:S: no assists are logged, so no player has one.
  const r = full();
  r.assists = { num: 0, den: 30 };
  const pts = radarPoints(r, avg({ assists: { num: 0, den: 3000 } }));
  assert.deepEqual(pts.map((p) => p.key), ["kpd", "kpm", "survived", "wins"]);
});

test("a player without rounds keeps the round axes, without data", () => {
  const r = full();
  r.survived = { num: 0, den: 0 };
  r.wins = { num: 0, den: 0 };
  const pts = radarPoints(r, avg());
  assert.deepEqual(pts.map((p) => p.key), [...RADAR_KEYS]);
  assert.deepEqual(pts.map((p) => p.noData), [false, false, false, true, true]);
  const wins = at(pts, "wins");
  assert.equal(wins.r, null);
  assert.equal(wins.rAvg, AVG_RING); // the average is still drawn
});

test("never fewer than three axes: no rounds and no assists logged", () => {
  // CS:S player with kills but no rounds, on a server that logs neither.
  const r: PlayerRatios = {
    kpd: { num: 22, den: 9 },
    kpm: { num: 22, den: 154 },
    assists: { num: 0, den: 22 },
    survived: { num: 0, den: 0 },
    wins: { num: 0, den: 0 },
  };
  const a = avg({ assists: { num: 0, den: 3000 }, survived: { num: 0, den: 0 }, wins: { num: 0, den: 0 } });
  const pts = radarPoints(r, a);
  assert.equal(pts.length, 3);
  assert.deepEqual(pts.filter((p) => !p.noData).map((p) => p.key), ["kpd", "kpm"]);
});

test("no activity in the last 14 days: the average alone", () => {
  const none = Object.fromEntries(RADAR_KEYS.map((k) => [k, null])) as PlayerRatios;
  const pts = radarPoints(none, avg());
  assert.deepEqual(pts.map((p) => p.key), [...RADAR_KEYS]);
  for (const p of pts) {
    assert.equal(p.noData, true);
    assert.equal(p.r, null);
    assert.equal(p.rAvg, AVG_RING);
  }
});

test("a real zero stays when the game records the stat", () => {
  const r = full();
  r.wins = { num: 0, den: 20 };
  const wins = at(radarPoints(r, avg()), "wins");
  assert.equal(wins.r, 0);
  assert.equal(wins.noData, false);
  near(wins.rel, 0);
});

test("no average to compare with: fixed scale", () => {
  const pts = radarPoints(full(), null);
  const kpd = at(pts, "kpd");
  assert.equal(kpd.rel, null);
  assert.equal(kpd.rAvg, 0);
  assert.equal(kpd.r, 1); // 3.0 is the top of the scale
  near(at(pts, "wins").r, 0.4 / FIXED_MAX.wins);
});

// The players of the screenshots: one far above the average, one below it
// on some axes, and one that played no rounds in the last 14 days.
test("screenshot players", () => {
  const a = avg({ kpd: { num: 1210, den: 1100 }, kpm: { num: 1210, den: 120000 }, assists: { num: 242, den: 1210 } });
  const strong = radarPoints({ kpd: { num: 60, den: 20 }, kpm: { num: 60, den: 2400 }, assists: { num: 18, den: 60 }, survived: { num: 12, den: 20 }, wins: { num: 14, den: 20 } }, a);
  assert.ok(strong.every((p) => p.r !== null && p.r > AVG_RING));
  const weak = radarPoints({ kpd: { num: 8, den: 16 }, kpm: { num: 8, den: 1200 }, assists: { num: 0, den: 8 }, survived: { num: 2, den: 10 }, wins: { num: 5, den: 10 } }, a);
  assert.ok(at(weak, "kpd").r! < AVG_RING);
  assert.equal(at(weak, "assists").r, 0);
  assert.equal(at(weak, "wins").r, AVG_RING);
  const noRounds = radarPoints({ kpd: { num: 5, den: 3 }, kpm: { num: 5, den: 600 }, assists: { num: 1, den: 5 }, survived: { num: 0, den: 0 }, wins: { num: 0, den: 0 } }, a);
  assert.deepEqual(noRounds.map((p) => p.noData), [false, false, false, true, true]);
});
