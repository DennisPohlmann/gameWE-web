// Admin API tokens and the admin API (/api/v1/admin): token format, hash,
// expiry and record; the strict JSON bodies; the routing, the admin levels
// (the same as the admin pages) and the operations a token must never reach.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { entities, getEntity } from "../src/lib/admin-entities.ts";
import { BodyError, entityInput, entityRow, writableFields, rawInput, scheduleInput, scheduleOut, settingsInput } from "../src/lib/admin-api-input.ts";
import { hiddenOption, rawKeyAllowed, settingGroups } from "../src/lib/admin-settings.ts";
import {
  EXPIRY_DAYS,
  OPTION_PREFIX,
  bearerToken,
  decodeRecord,
  displayPrefix,
  encodeRecord,
  expired,
  expiryDays,
  idOk,
  keyOfId,
  needsTouch,
  newToken,
  sameOwner,
  tokenId,
  tokenKey,
  tokenName,
  tokenShapeOk,
} from "../src/lib/api-token-core.ts";
import { ADMIN_ENTITIES, FORBIDDEN_WITH_TOKEN, adminOps, matchOp } from "../src/lib/openapi-admin.ts";
import { openApiDocument } from "../src/lib/openapi.ts";

const SECRET = "0123456789abcdef0123456789abcdef-test-only";
const src = (p: string) => readFileSync(p, "utf8");

// ---------------------------------------------------------------- tokens

test("a new token is gwe_ and 32 random bytes, different every time", () => {
  const a = newToken();
  const b = newToken();
  assert.match(a, /^gwe_[A-Za-z0-9_-]{43}$/);
  assert.ok(tokenShapeOk(a));
  assert.notEqual(a, b);
  assert.equal(displayPrefix(a), a.slice(0, 12));
  for (const bad of ["", "gwe_", `gwe_${"a".repeat(42)}`, `gwe_${"a".repeat(44)}`, `GWE_${"a".repeat(43)}`, `gwe_${"a".repeat(42)}=`, `gwe_${"a".repeat(42)} `]) {
    assert.equal(tokenShapeOk(bad), false, JSON.stringify(bad));
  }
});

test("only a keyed hash of the token is stored, found by its key", () => {
  const t = newToken();
  const k = tokenKey(t, SECRET);
  assert.ok(k.startsWith(OPTION_PREFIX));
  assert.ok(k.length <= 128, "fits hlstats_Options.keyname");
  assert.ok(!k.includes(t.slice(4)), "the token itself is not in the key");
  assert.equal(tokenKey(t, SECRET), k, "same token, same key");
  assert.notEqual(tokenKey(t, `${SECRET}x`), k, "a new ADMIN_SECRET makes old tokens unusable");
  assert.notEqual(tokenKey(newToken(), SECRET), k);
  const id = tokenId(k);
  assert.ok(idOk(id));
  assert.equal(keyOfId(id), k);
  for (const bad of ["", "g".repeat(48), "a".repeat(47), "A".repeat(48), `${"a".repeat(47)}'`]) assert.equal(idOk(bad), false, bad);
});

test("the token is read from Authorization: Bearer only", () => {
  const t = newToken();
  assert.equal(bearerToken(`Bearer ${t}`), t);
  assert.equal(bearerToken(`bearer ${t}`), t);
  for (const bad of [null, "", t, `Basic ${t}`, `Bearer`, `Bearer ${t} extra`, `Token ${t}`, `Bearer\t${t}`]) assert.equal(bearerToken(bad), null, String(bad));
});

test("token names and expiries are checked", () => {
  assert.equal(tokenName("  deploy script "), "deploy script");
  for (const bad of [undefined, null, 5, "", "   ", "x".repeat(41), "a\nb", "a\u0000b", "a‮b"]) assert.equal(tokenName(bad), null, JSON.stringify(bad));
  assert.equal(tokenName("ä".repeat(40)), "ä".repeat(40));
  for (const d of EXPIRY_DAYS) assert.equal(expiryDays(String(d)), d);
  for (const bad of ["", "1", "-7", "7.0", "365000", null, 7]) assert.equal(expiryDays(bad), null, String(bad));
});

test("the stored record round-trips, refuses junk and knows expiry and last use", () => {
  const r = { owner: "admin", name: "ci", prefix: "gwe_abcdefgh", created: 1000, expires: 2000, lastUsed: 0 };
  const v = encodeRecord(r)!;
  assert.ok(v.length <= 255);
  assert.deepEqual(decodeRecord(v), r);
  for (const bad of [null, "", "x", "{}", JSON.stringify({ v: 2, u: "a", n: "", p: "", c: 0, e: 0, l: 0 }), JSON.stringify({ v: 1, u: "", n: "", p: "", c: 0, e: 0, l: 0 }), JSON.stringify({ v: 1, u: "a", n: "", p: "", c: -1, e: 0, l: 0 })]) {
    assert.equal(decodeRecord(bad), null, String(bad));
  }
  assert.equal(encodeRecord({ ...r, owner: "x".repeat(200), name: "y".repeat(40) }), null, "too long for the column");
  assert.equal(expired(r, 1999), false);
  assert.equal(expired(r, 2000), true);
  assert.equal(expired({ ...r, expires: 0 }, 9e9), false, "0 = never");
  assert.equal(needsTouch(r, 299), false);
  assert.equal(needsTouch(r, 300), true);
  assert.equal(needsTouch({ ...r, lastUsed: 1000 }, 1100), false);
});

test("tokens never show up as raw options and cannot be written there", () => {
  for (const k of [`${OPTION_PREFIX}${"a".repeat(48)}`, "GAMEWE_APITOKEN_x", "gamewe_apitoken"]) {
    assert.ok(hiddenOption(k), k);
    assert.equal(rawKeyAllowed(k), false, k);
  }
});

test("owners are compared loosely when tokens are removed", () => {
  assert.ok(sameOwner("Admin ", "admin"));
  assert.ok(sameOwner("admin", " ADMIN"));
  assert.equal(sameOwner("admin", "admin2"), false);
});

// ---------------------------------------------------------------- bodies

const users = getEntity("users")!;
const servers = getEntity("servers")!;
const players = getEntity("players")!;
const games = getEntity("games")!;

function bodyError(fn: () => unknown, code: string, field?: string) {
  assert.throws(fn, (e: unknown) => e instanceof BodyError && e.code === code && (field === undefined || e.field === field));
}

test("entity bodies: unknown, read-only and create-only fields are refused", () => {
  bodyError(() => entityInput(servers, { name: "x", evil: 1 }, false), "unknown_field", "evil");
  bodyError(() => entityInput(players, { game: "css" }, false), "read_only_field", "game");
  bodyError(() => entityInput(players, { lastName: "x" }, false), "read_only_field", "lastName");
  bodyError(() => entityInput(users, { username: "other" }, false), "read_only_field", "username");
  bodyError(() => entityInput(games, { code: "new" }, false), "read_only_field", "code");
  bodyError(() => entityInput(games, { template: "css" }, false), "read_only_field", "template");
  // The collector reads the slots from the game server.
  bodyError(() => entityInput(servers, { max_players: 24 }, false), "read_only_field", "max_players");
  bodyError(() => entityInput(servers, { name: "x", address: "203.0.113.10", port: 27015, game: "css", max_players: 24 }, true), "read_only_field", "max_players");
  bodyError(() => entityInput(servers, {}, false), "invalid_body");
  bodyError(() => entityInput(servers, [], true), "invalid_body");
  bodyError(() => entityInput(servers, null, true), "invalid_body");
  // The table, key or a fixed column are no fields.
  bodyError(() => entityInput(servers, { serverId: 5 }, false), "unknown_field");
  bodyError(() => entityInput(getEntity("ranks")!, { definition_type: "ribbons" }, true), "unknown_field");
});

test("entity bodies: types must match and become the form's values", () => {
  bodyError(() => entityInput(servers, { port: "27015" }, false), "invalid_field", "port");
  bodyError(() => entityInput(servers, { port: 1.5 }, false), "invalid_field", "port");
  bodyError(() => entityInput(games, { hidden: "1" }, false), "invalid_field", "hidden");
  bodyError(() => entityInput(servers, { name: 5 }, false), "invalid_field", "name");
  bodyError(() => entityInput(servers, { rcon_password: "" }, false), "invalid_field", "rcon_password");
  bodyError(() => entityInput(users, { password: "a-new-password-123" }, false), "read_only_field", "password");
  const r = entityInput(servers, { port: 27016, rcon_password: null, game: "css" }, false);
  assert.deepEqual(r.entries, [["port", "27016"], ["rcon_password", "-"], ["game", "css"]]);
  assert.deepEqual([...(r.only ?? [])].sort(), ["game", "port", "rcon_password"]);
  assert.deepEqual(entityInput(games, { hidden: true }, false).entries, [["hidden", "1"]]);
  assert.deepEqual(entityInput(users, { acclevel: 80 }, false).entries, [["acclevel", "80"]]);
  const c = entityInput(games, { code: "x", template: "css", name: "X" }, true);
  assert.equal(c.only, undefined, "a new row gets every field");
});

test("entity rows: secrets and passwords never come back", () => {
  const out = entityRow(servers, { __pk: 3, name: "S", address: "203.0.113.10", port: 27015, game: "css ", rcon_password__set: 1, log_secret__set: 0, publicaddress: "", max_players: 0, display_id: 0 });
  assert.equal(out.id, 3);
  assert.equal(out.game, "css");
  assert.equal(out.rcon_passwordSet, true);
  assert.equal(out.log_secretSet, false);
  assert.equal(out.max_players, 0, "the slots are still returned");
  assert.ok(!("rcon_password" in out) && !("log_secret" in out));
  const u = entityRow(users, { __pk: "admin", username: "admin", acclevel: "100", password: "scrypt$..." });
  assert.ok(!("password" in u));
});

test("settings bodies: only the page's settings, with their types", () => {
  const general = settingGroups.find((g) => g.id === "general")!.items;
  bodyError(() => settingsInput(general, { gamewe_kill_points: 5 }), "unknown_field", "gamewe_kill_points");
  bodyError(() => settingsInput(general, { gamewe_chat_public: "1" }), "invalid_field", "gamewe_chat_public");
  bodyError(() => settingsInput(general, { MinActivity: "28" }), "invalid_field", "MinActivity");
  bodyError(() => settingsInput(general, {}), "invalid_body");
  const r = settingsInput(general, { gamewe_chat_public: true, MinActivity: 30 });
  assert.deepEqual(r.entries, [["gamewe_chat_public", "0"], ["gamewe_chat_public", "1"], ["MinActivity", "30"]]);
  const all = settingGroups.flatMap((g) => g.items);
  const secret = all.filter((s) => s.type === "secret");
  assert.ok(secret.length);
  assert.deepEqual(settingsInput(secret, { [secret[0].key]: null }).entries, [[`${secret[0].key}__clear`, "1"]]);
  const link = all.find((s) => s.type === "link")!;
  assert.deepEqual(settingsInput([link], { [link.key]: { label: "Forum", url: "https://example.org/" } }).entries, [[`${link.key}__label`, "Forum"], [`${link.key}__url`, "https://example.org/"]]);
  bodyError(() => settingsInput([link], { [link.key]: { label: "a", url: "b", x: 1 } }), "invalid_field");
});

test("raw options and schedules are checked", () => {
  const r = rawInput({ set: { a: "1" }, delete: ["b"], create: { key: "c", value: "2" } });
  assert.deepEqual(r.keys, ["a", "b"]);
  assert.equal(r.created, "c");
  bodyError(() => rawInput({ set: { a: 1 } }), "invalid_field");
  bodyError(() => rawInput({ set: { a: "1" }, delete: ["a"] }), "invalid_field");
  bodyError(() => rawInput({ other: 1 }), "unknown_field");
  bodyError(() => rawInput({}), "invalid_body");
  assert.deepEqual(scheduleInput({ unit: "month", every: 2, monthDay: 15 }), [["unit", "month"], ["every", "2"], ["mday", "15"]]);
  assert.deepEqual(scheduleInput({ unit: "year", month: 7, day: 1 }), [["unit", "year"], ["ymonth", "7"], ["yday", "1"]]);
  bodyError(() => scheduleInput({ unit: "week", monthDay: 3 }), "invalid_field");
  bodyError(() => scheduleInput({ unit: "month", monthDay: 31 }), "invalid_field");
  bodyError(() => scheduleInput({ unit: "hour" }), "invalid_field");
  assert.deepEqual(scheduleOut({ unit: "week", every: 1, day: 3, month: 1 }), { unit: "week", every: 1, weekday: 3 });
  assert.equal(scheduleOut(null), null);
});

// ---------------------------------------------------------------- routing and rights

test("operations are unique and every one has a handler", () => {
  const keys = adminOps.map((o) => `${o.method} ${o.path}`);
  assert.equal(new Set(keys).size, keys.length, "a method and path twice");
  const ids = adminOps.map((o) => o.operationId);
  assert.equal(new Set(ids).size, ids.length, "an operationId twice");
  const code = src("src/lib/admin-api.ts");
  for (const op of adminOps) {
    assert.ok(op.path.startsWith("/admin/"), op.path);
    assert.match(code, new RegExp(`\\n  async ${op.handler}\\(`), `handler ${op.handler}`);
  }
});

test("paths are matched strictly; settings/raw is not a settings page", () => {
  const m = (path: string, method = "GET") => matchOp(path.split("/").filter(Boolean), method);
  assert.equal((m("rankings/css/bots") as { op: { handler: string } }).op.handler, "botsGet");
  assert.equal((m("settings/raw") as { op: { handler: string } }).op.handler, "rawGet");
  assert.equal((m("settings/general") as { op: { handler: string } }).op.handler, "settingsGet");
  assert.deepEqual(m("rankings/css/reset"), { allow: ["POST"] });
  for (const bad of ["rankings/../users", "servers/0", "servers/-1", "servers/1e3", "servers/12345678901", "rankings/a b", "nothing", "users/editor/password", "me/tokens", "tokens", "users/admin/totp"]) {
    assert.equal(m(bad), null, bad);
  }
});

test("no operation manages tokens, passwords or TOTP of the own account", () => {
  for (const op of adminOps) assert.doesNotMatch(op.path, /token|totp|password|session|login|logout|account/i, op.path);
  // Only the users entity writes hlstats_Users, and its handlers check the owner.
  const code = src("src/lib/admin-api.ts");
  for (const h of ["entityCreate", "entityUpdate", "entityDelete"]) {
    const body = code.slice(code.indexOf(`async ${h}(`), code.indexOf("\n  },", code.indexOf(`async ${h}(`)));
    assert.match(body, /guardSelf\(c, /, `${h} checks the own account`);
  }
  assert.ok(FORBIDDEN_WITH_TOKEN.length >= 4);
  const text = JSON.stringify(openApiDocument("1"));
  assert.ok(text.includes("self_security_forbidden"));
  assert.ok(text.includes("bearerAuth"));
});

test("the admin levels are those of the admin pages", () => {
  for (const m of ADMIN_ENTITIES) {
    const e = entities.find((x) => x.key === m.key)!;
    for (const op of adminOps.filter((o) => o.entity === m.key)) assert.equal(op.level, e.minLevel ?? 80, op.operationId);
  }
  // Rankings, servers and users need level 100 (as requireAdmin(100) and
  // requireAdmin(LEVEL_ADMIN) in app/admin/actions.ts).
  const admin = ["rankingServers", "rankingAssign", "serverMove", "botsSet", "vacSet", "hallSet", "hallEntries", "hallRemove", "hallRestore", "reset", "globalHallSet"];
  for (const h of admin) assert.equal(adminOps.find((o) => o.handler === h)?.level, 100, h);
  for (const op of adminOps.filter((o) => o.path.startsWith("/admin/users"))) assert.equal(op.level, 100, op.operationId);
});

test("every server action of the admin area has an API operation or is account-only", () => {
  const actions = [...src("src/app/admin/actions.ts").matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
  const viaApi: Record<string, string[]> = {
    saveAction: ["entityCreate", "entityUpdate"],
    deleteAction: ["entityDelete"],
    assignServersAction: ["rankingAssign"],
    moveServerAction: ["serverMove"],
    saveSettingsAction: ["settingsSet", "rawSet"],
    savePrivacyAction: ["privacySet"],
    resetRankingAction: ["reset"],
    rankingBotsAction: ["botsSet"],
    rankingVacAction: ["vacSet"],
    hallOfFameSettingsAction: ["hallSet"],
    globalHallAction: ["globalHallSet"],
    hallEntryAction: ["hallRemove", "hallRestore"],
  };
  // Sign-in, own password, own TOTP, own tokens, look of the admin area:
  // only signed in, never with a token.
  const accountOnly = ["loginAction", "loginCodeAction", "loginCancelAction", "logoutAction", "adminThemeAction", "totpStartAction", "totpCancelAction", "totpConfirmAction", "totpDisableAction", "changePasswordAction", "createApiTokenAction", "revokeApiTokenAction"];
  for (const a of actions) {
    if (accountOnly.includes(a)) continue;
    assert.ok(viaApi[a], `${a} has no admin API operation`);
    for (const h of viaApi[a]) assert.ok(adminOps.some((o) => o.handler === h), `${a}: ${h}`);
  }
});

test("a password is set only when an admin is created; afterwards only its owner changes it", () => {
  assert.ok(writableFields(users, true).some((f) => f.name === "password"), "a new admin gets a first password");
  assert.ok(!writableFields(users, false).some((f) => f.name === "password"), "no PATCH of another admin's password");
  assert.deepEqual(entityInput(users, { username: "new", password: "first-password-1", acclevel: "80" }, true).entries.map(([k]) => k), ["username", "password", "acclevel"]);
  // The API answers 403 password_own_only before the body is read, and the
  // shared save (also the admin pages' form) refuses a sent password.
  const api = src("src/lib/admin-api.ts");
  const update = api.slice(api.indexOf("async entityUpdate("), api.indexOf("async entityDelete("));
  assert.match(update, /"password" in c\.body[\s\S]*password_own_only/);
  assert.match(src("src/lib/admin-ops.ts"), /e\.key === "users" && id !== null && String\(form\.get\("password"\)[^\n]*OpError\("password"\)/);
  const doc = JSON.stringify(openApiDocument("1"));
  assert.ok(doc.includes("password_own_only"));
  const schema = (openApiDocument("1") as { components: { schemas: Record<string, { properties: Record<string, unknown> }> } }).components.schemas;
  assert.ok(!("password" in schema.AdminUserUpdate.properties));
  assert.ok("password" in schema.AdminUserCreate.properties);
});
