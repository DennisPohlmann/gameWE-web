// Settings of the event boxes (ranking start page, player page).
// Run with `npm test` (node --test, Node's built-in type stripping).
import assert from "node:assert/strict";
import { test } from "node:test";
import { eventsListLive, eventsMode } from "../src/lib/events-mode.ts";

test("stored values are kept", () => {
  assert.equal(eventsMode("live"), "live");
  assert.equal(eventsMode(" static "), "static");
  assert.equal(eventsMode("off"), "off");
});

test("missing, empty or unknown values are live", () => {
  for (const v of [undefined, "", "1", "0", "sync", "OFF"]) assert.equal(eventsMode(v), "live");
});

test("the events page is live only on its first page, newest first", () => {
  assert.equal(eventsListLive("live", 1, false), true);
  assert.equal(eventsListLive("live", 2, false), false);
  assert.equal(eventsListLive("live", 1, true), false);
  assert.equal(eventsListLive("static", 1, false), false);
  assert.equal(eventsListLive("off", 1, false), false);
});
