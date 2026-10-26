// Settings that moved from the environment into hlstats_Options: the stored
// value wins, else the old environment variable, else the default; invalid
// values count as not set. Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULTS, envBacked, envFormValues, steamApiKey, steamKey, valueSource } from "../src/lib/config.ts";
import { allSettings, hiddenOption, settingGroups } from "../src/lib/admin-settings.ts";
import { LANGUAGES } from "../src/translations/languages.ts";

const fromEnv = (vars: Record<string, string>) => (name: string) => vars[name];
const noEnv = fromEnv({});
const KEY_A = "0123456789abcdef0123456789ABCDEF";
const KEY_B = "fedcba9876543210fedcba9876543210";

test("without database and environment the defaults apply", () => {
  assert.deepEqual(envBacked({}, noEnv), DEFAULTS);
});

test("the environment is the fallback when nothing is stored", () => {
  const env = fromEnv({ SITE_NAME: "Env Site", DEFAULT_LANG: "EN", ACTIVITY_DAYS: "14", PAGE_SIZE: "25", STEAM_PROFILES: "off" });
  assert.deepEqual(envBacked({}, env), { siteName: "Env Site", defaultLang: "en", activityDays: 14, pageSize: 25, steamProfiles: false });
  // Empty rows (a saved but empty field) count as not stored.
  assert.equal(envBacked({ sitename: " ", MinActivity: "" }, env).siteName, "Env Site");
});

test("a stored value wins over the environment", () => {
  const env = fromEnv({ SITE_NAME: "Env Site", DEFAULT_LANG: "en", ACTIVITY_DAYS: "14", PAGE_SIZE: "25", STEAM_PROFILES: "off" });
  const o = { sitename: "DB Site", gamewe_default_lang: "fr", MinActivity: "60", gamewe_page_size: "100", gamewe_steam_profiles: "1" };
  assert.deepEqual(envBacked(o, env), { siteName: "DB Site", defaultLang: "fr", activityDays: 60, pageSize: 100, steamProfiles: true });
  assert.equal(envBacked({ gamewe_steam_profiles: "0" }, fromEnv({ STEAM_PROFILES: "on" })).steamProfiles, false);
});

test("invalid values fall through to the next source", () => {
  const env = fromEnv({ DEFAULT_LANG: "xx", ACTIVITY_DAYS: "-3", PAGE_SIZE: "abc", STEAM_PROFILES: "maybe" });
  assert.deepEqual(envBacked({ gamewe_default_lang: "klingon", MinActivity: "0", gamewe_page_size: "1e3", gamewe_steam_profiles: "2" }, env), DEFAULTS);
  assert.equal(envBacked({ gamewe_default_lang: "zz" }, fromEnv({ DEFAULT_LANG: "pt-br" })).defaultLang, "pt-br");
});

test("numbers are capped like the admin form", () => {
  assert.equal(envBacked({ MinActivity: "99999" }, noEnv).activityDays, 3650);
  assert.equal(envBacked({}, fromEnv({ PAGE_SIZE: "100000" })).pageSize, 500);
});

test("the Steam API key: database, else environment, only 32 hex digits", () => {
  assert.equal(steamApiKey(KEY_A, fromEnv({ STEAM_API_KEY: KEY_B })), KEY_A);
  assert.equal(steamApiKey(undefined, fromEnv({ STEAM_API_KEY: KEY_B })), KEY_B);
  assert.equal(steamApiKey("", fromEnv({ STEAM_API_KEY: KEY_B })), KEY_B);
  assert.equal(steamApiKey("not-a-key", noEnv), null);
  assert.equal(steamApiKey(undefined, noEnv), null);
  assert.equal(steamKey(`${KEY_A}0`), null);
  assert.equal(steamKey(` ${KEY_A} `), KEY_A);
});

test("value source and form values for the admin page", () => {
  const env = fromEnv({ SITE_NAME: "Env Site", STEAM_API_KEY: KEY_B });
  assert.equal(valueSource("sitename", "DB", env), "db");
  assert.equal(valueSource("sitename", undefined, env), "env");
  assert.equal(valueSource("gamewe_page_size", undefined, env), "default");
  assert.equal(valueSource("gamewe_steam_api_key", undefined, env), "env");
  assert.equal(valueSource("gamewe_steam_api_key", undefined, fromEnv({ STEAM_API_KEY: "short" })), "default");
  const form = envFormValues(env);
  assert.equal(form.sitename, "Env Site");
  assert.equal(form.gamewe_page_size, "50");
  // The key never goes into a form value.
  assert.ok(!Object.values(form).includes(KEY_B));
  assert.ok(!("gamewe_steam_api_key" in form));
});

test("admin fields: language list, bounds, switch and a write-only key for level 100", () => {
  const by = new Map(allSettings.map((s) => [s.key, s]));
  const langs = by.get("gamewe_default_lang");
  assert.equal(langs?.type, "choice");
  assert.deepEqual(langs?.choices?.map(([c]) => c), LANGUAGES.map((l) => l.code));
  assert.equal(by.get("gamewe_steam_profiles")?.type, "bool");
  const key = by.get("gamewe_steam_api_key");
  assert.equal(key?.type, "secret");
  assert.equal(key?.minLevel, 100);
  assert.ok(hiddenOption("gamewe_steam_api_key"), "the key must never be listed as a raw option");
  for (const k of ["MinActivity", "gamewe_page_size"]) {
    const s = by.get(k);
    assert.equal(s?.type, "number");
    assert.ok(s?.min !== undefined && s.max !== undefined && s.min >= 1);
  }
  assert.equal(settingGroups.find((g) => g.items.some((s) => s.key === "gamewe_steam_api_key"))?.id, "steam");
});
