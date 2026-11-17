// The "?" explanations (lib/admin-help.ts) belong to settings that exist.
// Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { SETTING_INFO } from "../src/lib/admin-help.ts";
import { allSettings } from "../src/lib/admin-settings.ts";

test("every explanation belongs to a setting", () => {
  const keys = new Set(allSettings.map((s) => s.key));
  assert.deepEqual(Object.keys(SETTING_INFO).filter((k) => !keys.has(k)), []);
});
