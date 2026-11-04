// The API switch (src/lib/api-switch.ts, Admin -> Settings -> API). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { API_DISABLED, apiDisabledResponse, apiSwitch } from "../src/lib/api-switch.ts";
import { allSettings, settingGroups } from "../src/lib/admin-settings.ts";
import { envBacked, envFormValues, valueSource } from "../src/lib/config.ts";

test("unset or empty: the API is on", () => {
  for (const v of [undefined, "", "  "]) assert.deepEqual(apiSwitch(v), { on: true, invalid: false }, String(v));
});

test("on and off values", () => {
  for (const v of ["on", "ON", " true ", "1", "yes", "enabled"]) assert.deepEqual(apiSwitch(v), { on: true, invalid: false }, v);
  for (const v of ["off", "Off", "false", "0", "no", " disabled "]) assert.deepEqual(apiSwitch(v), { on: false, invalid: false }, v);
});

test("an unknown value turns the API off", () => {
  for (const v of ["of", "2", "nein", "enabledx", "on off"]) assert.deepEqual(apiSwitch(v), { on: false, invalid: true }, v);
});

test("the stored setting wins over the old variable, which only starts it", () => {
  const off = (n: string) => (n === "API_ENABLED" ? "off" : undefined);
  const none = () => undefined;
  assert.equal(envBacked({}, none).apiEnabled, true);
  assert.equal(envBacked({ gamewe_api_enabled: "0" }, none).apiEnabled, false);
  // An update must not open an API that web.env has closed.
  assert.equal(envBacked({}, off).apiEnabled, false);
  assert.equal(envBacked({}, (n) => (n === "API_ENABLED" ? "bogus" : undefined)).apiEnabled, false);
  assert.equal(envFormValues(off).gamewe_api_enabled, "0");
  assert.equal(valueSource("gamewe_api_enabled", undefined, off), "env");
  // Saved once, the environment no longer counts, in both directions.
  assert.equal(envBacked({ gamewe_api_enabled: "1" }, off).apiEnabled, true);
  assert.equal(envBacked({ gamewe_api_enabled: "0" }, (n) => (n === "API_ENABLED" ? "on" : undefined)).apiEnabled, false);
  assert.equal(valueSource("gamewe_api_enabled", "1", off), "db");
});

test("the field: a switch on its own settings page, only for level 100", () => {
  const s = allSettings.find((x) => x.key === "gamewe_api_enabled");
  assert.equal(s?.type, "bool");
  assert.equal(s?.def, "1");
  assert.equal(s?.minLevel, 100);
  assert.equal(settingGroups.find((g) => g.items.includes(s!))?.id, "api");
});

test("the answer while off: 404, JSON, not cached", async () => {
  const r = apiDisabledResponse();
  assert.equal(r.status, 404);
  assert.match(r.headers.get("content-type") ?? "", /^application\/json/);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(await r.json(), API_DISABLED);
  assert.equal(API_DISABLED.error, "api_disabled");
});

// Every route under src/app/api answers through api(), apiImage() or
// adminApi(), which check the switch first; a route of its own would stay
// open while the API is off.
test("every API route goes through a guarded helper", async () => {
  const { readdirSync, readFileSync } = await import("node:fs");
  const { join } = await import("node:path");
  const routes: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (/^route\.tsx?$/.test(e.name)) routes.push(join(dir, e.name));
    }
  };
  walk("src/app/api");
  assert.ok(routes.length > 10);
  for (const r of routes) assert.match(readFileSync(r, "utf8"), /\b(api|apiImage|adminApi)\(/, r);
  for (const [file, fn] of [["src/lib/api.ts", "api"], ["src/lib/api.ts", "apiImage"], ["src/lib/admin-api.ts", "adminApi"]]) {
    const src = readFileSync(file, "utf8");
    const body = src.slice(src.indexOf(`export async function ${fn}(`));
    assert.match(body.split("\n").slice(1, 4).join("\n"), /if \(!\(await apiEnabled\(\)\)\) return apiDisabledResponse\(\);/, `${file} ${fn}`);
  }
});
