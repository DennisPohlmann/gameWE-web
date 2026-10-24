// Settings of the event boxes (ranking start page, player page).
// Run with `npm test` (node --test, Node's built-in type stripping).
import assert from "node:assert/strict";
import { test } from "node:test";
import { eventsMode } from "../src/lib/events-mode.ts";

test("stored values are kept", () => {
  assert.equal(eventsMode("live"), "live");
  assert.equal(eventsMode(" static "), "static");
  assert.equal(eventsMode("off"), "off");
});

test("missing, empty or unknown values are live", () => {
  for (const v of [undefined, "", "1", "0", "sync", "OFF"]) assert.equal(eventsMode(v), "live");
});
