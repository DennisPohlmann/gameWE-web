// Shares and sorting of the teams/roles, weapons and actions tables, map
// shares, bar fill and the CT/T win split. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionBonus,
  actionName,
  actionShares,
  actionSort,
  relativeFill,
  rowShares,
  shareText,
  shareTotals,
  sortActions,
  sortTeams,
  teamSort,
  weaponShares,
  weaponTotals,
  winSplit,
  winsByMap,
} from "../src/lib/shares.ts";

const teams = [
  { id: 1, name: "Terrorist", time_played: 6000, kills: 300, deaths: 200 },
  { id: 2, name: "Counter-Terrorist", time_played: 3000, kills: 100, deaths: 200 },
  { id: 3, name: "Spectator", time_played: 1000, kills: 0, deaths: 0 },
];

test("time, kills and deaths are shares of the table's own totals", () => {
  const total = shareTotals(teams);
  assert.deepEqual(total, { time: 10000, kills: 400, deaths: 400 });
  const t = rowShares(teams[0], total);
  assert.equal(Math.round(t.timePct * 100), 60);
  assert.equal(Math.round(t.killsPct * 100), 75);
  assert.equal(Math.round(t.deathsPct * 100), 50);
  assert.equal(t.kpd.toFixed(2), "1.50");
  assert.equal(rowShares(teams[1], total).kpd.toFixed(2), "0.50");
});

test("a spectator has time but no kills or deaths", () => {
  const s = rowShares(teams[2], shareTotals(teams));
  assert.equal(s.fought, false);
  assert.equal(Math.round(s.timePct * 100), 10);
  assert.equal(s.killsPct, 0);
  assert.equal(s.deathsPct, 0);
  assert.equal(s.kpd.toFixed(2), "0.00");
});

test("empty totals give 0 %, not NaN; no deaths gives the kills as kpd", () => {
  const rows = [{ id: 1, name: "A", time_played: 0, kills: 4, deaths: 0 }];
  const s = rowShares(rows[0], { time: 0, kills: 0, deaths: 0 });
  assert.deepEqual([s.timePct, s.killsPct, s.deathsPct], [0, 0, 0]);
  assert.equal(s.kpd, 4);
  assert.equal(rowShares(rows[0], shareTotals(rows)).killsPct, 1);
});

test("counters that come back as strings are added, not joined", () => {
  const rows = [
    { id: 1, name: "A", time_played: "120", kills: "3", deaths: "1" },
    { id: 2, name: "B", time_played: "80", kills: "1", deaths: "3" },
  ] as unknown as typeof teams;
  assert.deepEqual(shareTotals(rows), { time: 200, kills: 4, deaths: 4 });
});

test("sorting: time first by default, names A to Z, dir=asc flips", () => {
  assert.equal(teamSort(""), "time");
  assert.equal(teamSort("joined"), "time");
  assert.equal(teamSort("kpd"), "kpd");
  const ids = (rows: typeof teams) => rows.map((r) => r.id);
  assert.deepEqual(ids(sortTeams(teams, "time", false)), [1, 2, 3]);
  assert.deepEqual(ids(sortTeams(teams, "time", true)), [3, 2, 1]);
  assert.deepEqual(ids(sortTeams(teams, "name", false)), [2, 3, 1]);
  assert.deepEqual(ids(sortTeams(teams, "name", true)), [1, 3, 2]);
  assert.deepEqual(ids(sortTeams(teams, "kpd", false)), [1, 2, 3]);
  // Equal deaths keep the id order.
  assert.deepEqual(ids(sortTeams(teams, "deaths", false)), [1, 2, 3]);
});

test("weapons: kills %, headshots % of all and hpk of the weapon", () => {
  const weapons = [
    { kills: 600, headshots: 300 },
    { kills: 400, headshots: 100 },
    { kills: 0, headshots: 0 },
  ];
  const total = weaponTotals(weapons);
  assert.deepEqual(total, { kills: 1000, headshots: 400 });
  const a = weaponShares(weapons[0], total);
  assert.deepEqual([a.killsPct, a.headshotsPct, a.hpk], [0.6, 0.75, 0.5]);
  const b = weaponShares(weapons[1], total);
  assert.equal(Math.round(b.hpk * 100), 25);
  assert.deepEqual(weaponShares(weapons[2], total), { killsPct: 0, headshotsPct: 0, hpk: 0 });
  assert.deepEqual(weaponShares(weapons[0], { kills: 0, headshots: 0 }), { killsPct: 0, headshotsPct: 0, hpk: 0.5 });
});

test("actions: achieved share, signed skill bonus and sorting", () => {
  const actions = [
    { id: 1, code: "Planted_The_Bomb", description: "Planted the bomb", reward_player: 50, reward_team: 0, count: 300 },
    { id: 2, code: "Killed_A_Hostage", description: "", reward_player: -5, reward_team: 0, count: 100 },
    { id: 3, code: "CTs_Win", description: "All Terrorists eliminated", reward_player: 0, reward_team: 1, count: 600 },
  ];
  const { total, pct } = actionShares(actions);
  assert.equal(total, 1000);
  assert.deepEqual(actions.map((a) => Math.round(pct(a) * 100)), [30, 10, 60]);
  assert.deepEqual(actions.map(actionBonus), [50, -5, 1]);
  assert.equal(actionName(actions[1]), "Killed_A_Hostage");
  assert.equal(actionShares([]).total, 0);
  assert.equal(actionShares([{ ...actions[0], count: 0 }]).pct(actions[0]), 0);
  const ids = (rows: typeof actions) => rows.map((r) => r.id);
  assert.equal(actionSort("bogus"), "count");
  assert.deepEqual(ids(sortActions(actions, "count", false)), [3, 1, 2]);
  assert.deepEqual(ids(sortActions(actions, "bonus", false)), [1, 3, 2]);
  assert.deepEqual(ids(sortActions(actions, "bonus", true)), [2, 3, 1]);
  assert.deepEqual(ids(sortActions(actions, "name", false)), [3, 2, 1]);
});

test("shares keep one decimal", () => {
  assert.equal(shareText(0.0053, "en"), "0.5%");
  assert.equal(shareText(0.0092, "en"), "0.9%");
  assert.equal(shareText(0.0109, "en"), "1.1%");
  assert.equal(shareText(0.25, "en"), "25.0%");
  assert.equal(shareText(1, "en"), "100.0%");
  assert.equal(shareText(0.0053, "de"), "0,5%");
});

test("tiny shares are not shown as zero, none is zero", () => {
  assert.equal(shareText(0.0004, "en"), "<0.1%");
  assert.equal(shareText(0.0000001, "en"), "<0.1%");
  assert.equal(shareText(0.0005, "en"), "0.1%");
  assert.equal(shareText(0, "en"), "0%");
  assert.equal(shareText(null, "en"), "0%");
  assert.equal(shareText(Number.NaN, "en"), "0%");
});

test("bars fill relative to the largest share", () => {
  assert.equal(relativeFill(0.02, 0.02), 1);
  assert.equal(relativeFill(0.01, 0.02), 0.5);
  assert.equal(relativeFill(0, 0.02), 0);
  assert.equal(relativeFill(0.01, 0), 0);
  assert.equal(relativeFill(null, 0.5), 0);
  assert.equal(relativeFill(0.9, 0.5), 1);
});

test("win split adds up to 100", () => {
  assert.deepEqual(winSplit(1, 1), { ct: 50, t: 50 });
  assert.deepEqual(winSplit(2, 1), { ct: 67, t: 33 });
  assert.deepEqual(winSplit(1, 2), { ct: 33, t: 67 });
  assert.deepEqual(winSplit(5, 0), { ct: 100, t: 0 });
  assert.deepEqual(winSplit(0, 3), { ct: 0, t: 100 });
  for (let a = 0; a < 40; a++) {
    for (let b = 0; b < 40; b++) {
      const s = winSplit(a, b);
      if (a + b === 0) assert.equal(s, null);
      else assert.equal(s!.ct + s!.t, 100);
    }
  }
});

test("a side with wins never shows 0 %", () => {
  assert.deepEqual(winSplit(1, 999), { ct: 1, t: 99 });
  assert.deepEqual(winSplit(999, 1), { ct: 99, t: 1 });
});

test("no wins is no data, not 50/50", () => {
  assert.equal(winSplit(0, 0), null);
  assert.equal(winSplit(-1, 0), null);
});

test("wins are summed per map and side", () => {
  const m = winsByMap([
    { map: 7, team: "CT", wins: 3 },
    { map: "7", team: "TERRORIST", wins: "2" },
    { map: 8, team: "terrorist", wins: 4 },
    { map: 9, team: "", wins: 10 },
    { map: 9, team: null, wins: 10 },
    { map: 10, team: "Red", wins: 1 },
  ]);
  assert.deepEqual(m.get(7), { ct: 3, t: 2 });
  assert.deepEqual(m.get(8), { ct: 0, t: 4 });
  assert.equal(m.has(9), false);
  assert.equal(m.has(10), false);
});
