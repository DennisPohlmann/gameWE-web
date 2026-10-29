// API_ENABLED: turns the whole API on (default) or off - the public API
// (/api/v1/...), the admin API with its token authentication
// (/api/v1/admin/...), the documentation (/api, /api/openapi.json) and the
// API tokens under Admin > My account. Read from the environment on every
// request, never baked in at build time, so one image can run either way.
// No server-only import, so the tests can load it.
import { env } from "./env.ts";

export const API_ENABLED_VAR = "API_ENABLED";

const ON = ["1", "on", "true", "yes", "enable", "enabled"];
const OFF = ["0", "off", "false", "no", "disable", "disabled"];

// Answer of every API path while the API is off.
export const API_DISABLED = { error: "api_disabled", message: `the API is turned off on this site (${API_ENABLED_VAR}=off)` } as const;

// The switch of a value: unset or empty is on; an unknown value counts as
// off (warned about in the log), so a typo never leaves the API open that
// was meant to be closed.
export function apiSwitch(v: string | undefined): { on: boolean; invalid: boolean } {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "" || ON.includes(s)) return { on: true, invalid: false };
  if (OFF.includes(s)) return { on: false, invalid: false };
  return { on: false, invalid: true };
}

let warned = false;

export function apiEnabled(): boolean {
  const raw = env(API_ENABLED_VAR);
  const r = apiSwitch(raw);
  if (r.invalid && !warned) {
    warned = true;
    console.warn(`gameWE: ${API_ENABLED_VAR} must be on or off, not "${raw?.slice(0, 40)}"; the API stays off`);
  }
  return r.on;
}

// 404 with API_DISABLED, the answer of every API path while it is off.
export function apiDisabledResponse(): Response {
  return new Response(JSON.stringify(API_DISABLED), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
