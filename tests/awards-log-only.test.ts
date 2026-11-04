import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// awards.ts imports the database and cannot load here: the check reads the
// source, as in admin-api.test.ts.
test("the day's action awards leave out rows only meant for the event lists", () => {
  const s = readFileSync("src/lib/awards.ts", "utf8");
  assert.match(s, /" AND e\.log_only = 0" : ""/);
  assert.match(s, /FROM hlstats_Events_PlayerActions e\s+WHERE e\.timestamp_id >= \? AND e\.timestamp_id < \?\$\{countedOnly\}/);
});
