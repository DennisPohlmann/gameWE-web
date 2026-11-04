// The API switch (Admin -> Settings -> API, gamewe_api_enabled): turns the whole
// API on (default) or off - the public API (/api/v1/...), the admin API with
// its token authentication (/api/v1/admin/...), the documentation (/api,
// /api/openapi.json) and the API tokens under Admin > My account.
// apiEnabled() in lib/settings.ts reads it. No server-only import, so the
// tests can load this file.

// Answer of every API path while the API is off.
export const API_DISABLED = { error: "api_disabled", message: "the API is turned off on this site" } as const;

// The old environment variable API_ENABLED, still honoured while the setting
// is not stored: unset or empty is on; an unknown value counts as off, so a
// typo never leaves the API open that was meant to be closed.
const ON = ["1", "on", "true", "yes", "enable", "enabled"];
const OFF = ["0", "off", "false", "no", "disable", "disabled"];

export function apiSwitch(v: string | undefined): { on: boolean; invalid: boolean } {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "" || ON.includes(s)) return { on: true, invalid: false };
  if (OFF.includes(s)) return { on: false, invalid: false };
  return { on: false, invalid: true };
}

// 404 with API_DISABLED, the answer of every API path while it is off.
export function apiDisabledResponse(): Response {
  return new Response(JSON.stringify(API_DISABLED), {
    status: 404,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
