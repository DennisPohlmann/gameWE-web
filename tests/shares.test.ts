// Shares and sorting of the teams/roles, weapons and actions tables. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { rowShares, shareTotals, sortTeams, teamSort, weaponShares, weaponTotals } from "../src/lib/shares.ts";

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
