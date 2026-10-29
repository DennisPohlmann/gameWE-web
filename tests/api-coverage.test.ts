// Pure parts of the endpoints that cover the rest of the website: the
// activity per 15 minutes, the event filters and what an event carries.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, optionalEnumArg } from "../src/lib/api-params.ts";
import { activityDaysArg, activitySeries } from "../src/lib/api-activity.ts";
import { eventDetail, periodArg, typeArg } from "../src/lib/api-events.ts";

const q = (o: Record<string, string>) => new URLSearchParams(o);

test("activity: the days of the website's charts only", () => {
  assert.equal(activityDaysArg(q({}), 30), 30);
  assert.equal(activityDaysArg(q({}), 14), 14);
  assert.equal(activityDaysArg(q({ days: "7" }), 30), 7);
  for (const bad of ["0", "2", "31", "365", "x", ""]) assert.throws(() => activityDaysArg(q({ days: bad }), 30), ApiError, bad);
});

test("activity: one entry per step with its time, load null where none was recorded", () => {
  const s = activitySeries({ start: 900, step: 900, players: [null, 3.5], servers: [null, 1], kills: [0, 4], headshots: [0, 1] });
  assert.equal(s.step, 900);
  assert.deepEqual(s.data, [
    { time: 900, players: null, servers: null, kills: 0, headshots: 0 },
    { time: 1800, players: 3.5, servers: 1, kills: 4, headshots: 1 },
  ]);
});

test("events: period and type as on the events page", () => {
  assert.equal(periodArg(q({})), "24h");
  assert.equal(periodArg(q({ period: "7d" })), "7d");
  assert.throws(() => periodArg(q({ period: "30d" })), ApiError);
  assert.equal(typeArg(q({})), "");
  assert.equal(typeArg(q({ type: "kill" })), "kill");
  // Actions on players are part of "action", not a filter of their own.
  assert.throws(() => typeArg(q({ type: "playeraction" })), ApiError);
});

test("events: weapon and headshot of kills, bonus of actions, old and new name", () => {
  const kill = eventDetail("kill", 1, "AK-47", "ak47");
  assert.deepEqual(kill.weapon, { code: "ak47", name: "AK-47" });
  assert.equal(kill.headshot, true);
  assert.equal(kill.action, null);
  assert.equal(eventDetail("death", 0, "", "awp").weapon?.name, "awp");
  assert.equal(eventDetail("suicide", 0, "", "world").headshot, null);
  assert.deepEqual(eventDetail("action", 3, "Planted the bomb", "Planted_The_Bomb").action, { code: "Planted_The_Bomb", name: "Planted the bomb", bonus: 3 });
  assert.deepEqual(eventDetail("team", 0, "Terrorists", "TERRORIST").team, { code: "TERRORIST", name: "Terrorists" });
  const name = eventDetail("name", 0, "Old", "New");
  assert.equal(name.oldName, "Old");
  assert.equal(name.newName, "New");
  assert.equal(name.weapon, null);
  // Connects carry nothing besides the player.
  assert.deepEqual(Object.values(eventDetail("connect", 0, "", "")).filter((v) => v !== null), []);
});

test("optional choices: absent or empty is none, anything else must be listed", () => {
  assert.equal(optionalEnumArg(q({}), "level", ["upper", "lower"]), "");
  assert.equal(optionalEnumArg(q({ level: "" }), "level", ["upper", "lower"]), "");
  assert.equal(optionalEnumArg(q({ level: "lower" }), "level", ["upper", "lower"]), "lower");
  assert.throws(() => optionalEnumArg(q({ level: "../" }), "level", ["upper", "lower"]), { message: "invalid level: one of upper, lower" });
});
