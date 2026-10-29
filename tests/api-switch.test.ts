// The API_ENABLED switch (src/lib/api-switch.ts). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { API_DISABLED, apiDisabledResponse, apiEnabled, apiSwitch } from "../src/lib/api-switch.ts";

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

test("apiEnabled reads the environment on every call (quotes as in web.env)", () => {
  const before = process.env.API_ENABLED;
  const warn = console.warn;
  const warnings: string[] = [];
  console.warn = (m: string) => void warnings.push(m);
  try {
    delete process.env.API_ENABLED;
    assert.equal(apiEnabled(), true);
    process.env.API_ENABLED = "off";
    assert.equal(apiEnabled(), false);
    process.env.API_ENABLED = '"on"';
    assert.equal(apiEnabled(), true);
    process.env.API_ENABLED = "'false'";
    assert.equal(apiEnabled(), false);
    process.env.API_ENABLED = "bogus";
    assert.equal(apiEnabled(), false);
    assert.equal(apiEnabled(), false);
    assert.equal(warnings.length, 1, "an unknown value is warned about once");
  } finally {
    console.warn = warn;
    if (before === undefined) delete process.env.API_ENABLED;
    else process.env.API_ENABLED = before;
  }
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
    assert.match(body.split("\n").slice(1, 4).join("\n"), /if \(!apiEnabled\(\)\) return apiDisabledResponse\(\);/, `${file} ${fn}`);
  }
});
