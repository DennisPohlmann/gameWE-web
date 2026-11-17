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

// Every privacy setting on /admin/privacy, the points and in-game commands in
// the rankings area, no Collector group in the settings (Dennis, 2026-11-17).
test("privacy settings are on the privacy page, points and commands under rankings", async () => {
  const { readFileSync } = await import("node:fs");
  const ids = (area: string) => settingGroups.filter((g) => g.area === area).map((g) => g.id);
  assert.deepEqual(settingGroups.find((g) => g.area === "privacy")?.items.map((s) => s.key), ["gamewe_store_chat", "gamewe_store_player_ip", "gamewe_store_locations"]);
  assert.ok(settingGroups.every((g) => g.area !== "privacy" || g.items.every((s) => s.type === "bool")), "the privacy page draws only switches");
  const nav = readFileSync("src/components/admin/nav.tsx", "utf8");
  assert.match(nav, new RegExp(`const RANKING_SETTINGS = ${JSON.stringify(ids("rankings")).replace(/[[\]]/g, "\\$&").replace(/,/g, ", ")};`));
  assert.doesNotMatch(nav, /groupLinks\("collector"/);
  assert.match(readFileSync("src/app/admin/(panel)/settings/[group]/page.tsx", "utf8"), /area === "privacy"\) redirect\("\/admin\/privacy"\)/);
});
