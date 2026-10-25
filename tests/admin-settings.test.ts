// The settings pages of the admin area: every setting is on exactly one
// page, and the pages have unique ids. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { RAW_GROUP, allSettings, definedSettings, settingGroups } from "../src/lib/admin-settings.ts";

test("every setting is on exactly one settings page", () => {
  const keys = allSettings.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length, "a setting is on two pages");
  assert.deepEqual([...keys].sort(), definedSettings.map((s) => s.key).sort());
});

test("settings pages have unique ids and none is the raw page", () => {
  const ids = settingGroups.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.includes(RAW_GROUP));
  for (const g of settingGroups) assert.match(g.id, /^[a-z]+$/);
});
