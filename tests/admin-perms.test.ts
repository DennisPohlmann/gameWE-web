// Fine-grained rights of the admins (lib/admin-perms.ts): what level 80
// keeps without stored rights, what a change implies, and that pages,
// actions, API and MCP all check the same rights.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LEVEL80_DEFAULT, PERMS, PERM_GROUPS, ROLE_PRESETS, ROLE_REF, allowed, nameKey, effectivePerms, isPerm, isRoleId, normalizePerms, parsePerms, parseRole, permMap, permsKey, permsValue, roleName, roleOf, roleValue } from "../src/lib/admin-perms.ts";
import { HIDDEN_OPTION_PREFIXES } from "../src/lib/admin-settings.ts";
import { PERM_T } from "../src/lib/admin-texts.ts";
import { tools } from "../src/lib/admin-mcp.ts";
import { adminOps } from "../src/lib/openapi-admin.ts";

const src = (p: string) => readFileSync(p, "utf8");

test("without a stored row level 80 keeps its old rights; level 100 has all", () => {
  assert.deepEqual(parsePerms(null), LEVEL80_DEFAULT);
  assert.deepEqual(parsePerms(undefined), LEVEL80_DEFAULT);
  // A stored empty value is no right at all, not the default.
  assert.deepEqual(parsePerms(""), []);
  for (const p of PERMS) assert.ok(allowed({ acclevel: 100 }, p), p);
  assert.ok(allowed({ acclevel: 100 }, "admin"));
  assert.deepEqual(effectivePerms({ acclevel: 100, perms: [] }), [...PERMS]);
  // Level 80 never manages admins, whatever is stored.
  assert.equal(allowed({ acclevel: 80, perms: [...PERMS] }, "admin"), false);
  assert.equal(allowed({ acclevel: 80, perms: [] }, null), true, "the overview and the account are for every admin");
  assert.equal(allowed({ acclevel: 80, perms: ["chat.view"] }, "ips.view"), false);
  assert.equal(permMap({ acclevel: 80, perms: ["ips.view"] })["ips.view"], true);
});

test("changing implies seeing; unknown rights are dropped; the value fits the column", () => {
  assert.deepEqual(normalizePerms(["rankings.edit"]), ["rankings.view", "rankings.edit"]);
  assert.deepEqual(normalizePerms(["settings.protected"]), ["settings.view", "settings.edit", "settings.protected"]);
  assert.deepEqual(normalizePerms(["players.erase", "x", "players.erase"]), ["players.view", "players.erase"]);
  assert.deepEqual(parsePerms(" chat.view , nope"), ["chat.view"]);
  assert.ok(permsValue([...PERMS]).length <= 255, "hlstats_Options.value is varchar(255)");
  assert.equal(isPerm("admin"), false);
  // The same row for every spelling the database may treat as the same name.
  assert.equal(permsKey("Editor "), permsKey("editor"));
  assert.match(permsKey("editor"), /^gamewe_perms_[0-9a-f]{32}$/);
  // Never listed or written on the raw settings page.
  assert.ok(HIDDEN_OPTION_PREFIXES.includes("gamewe_perms_"));
});

test("every right is on the admin's page with a text, every preset is known", () => {
  assert.deepEqual(PERM_GROUPS.flatMap((g) => g.perms).sort(), [...PERMS].sort());
  for (const lang of ["de", "en"] as const) {
    for (const p of PERMS) assert.ok(PERM_T[lang].perm[p], `${lang} ${p}`);
    for (const g of PERM_GROUPS) assert.ok(PERM_T[lang].groups[g.id], `${lang} ${g.id}`);
    for (const r of ROLE_PRESETS) assert.ok(PERM_T[lang].preset[r.id as keyof (typeof PERM_T)["de"]["preset"]], `${lang} ${r.id}`);
  }
  for (const r of ROLE_PRESETS) assert.ok(r.perms.every(isPerm), r.id);
});

test("every API operation and MCP tool needs a known right", () => {
  for (const op of adminOps) assert.ok(op.need === null || op.need === "admin" || isPerm(op.need), op.operationId);
  // A chat moderator gets the chat and nothing else that changes or reads data.
  const chat = tools({ acclevel: 80, perms: ["chat.view"] }, ["read", "write", "mcp"]).map((t) => t.name).sort();
  // Every admin has their own account and notifications.
  const own = ["adminMyNotificationTest", "adminMyNotifications", "adminSetMyNotifications"];
  assert.deepEqual(chat, ["adminChat", "adminMe", ...own]);
  const none = tools({ acclevel: 80, perms: [] }, ["read", "write", "mcp"]).map((t) => t.name).sort();
  assert.deepEqual(none, ["adminMe", ...own]);
  // Admins and their rights: level 100 only.
  for (const op of adminOps.filter((o) => o.entity === "users")) assert.equal(op.need, "admin", op.operationId);
});

test("the pages and actions check the rights on the server, not only the menu", () => {
  const actions = src("src/app/admin/actions.ts");
  for (const [fn, need] of [
    ["deletePlayerAction", '"players.erase"'],
    ["resetRankingAction", '"resets"'],
    ["globalHallAction", '"resets"'],
    ["hallEntryAction", '"resets"'],
    ["hallOfFameSettingsAction", '"resets"'],
    ["rankingBotsAction", '"rankings.edit"'],
    ["rankingVacAction", '"rankings.edit"'],
    ["rankingFastdlAction", '"rankings.edit"'],
    ["assignServersAction", '"servers.edit"'],
    ["moveServerAction", '"servers.edit"'],
    ["saveSettingsAction", '"settings.edit"'],
    ["savePrivacyAction", '"settings.edit"'],
    ["saveAction", "e.perm.edit"],
    ["deleteAction", "e.perm.edit"],
  ]) {
    const body = actions.slice(actions.indexOf(`export async function ${fn}(`)).split("\nexport ")[0];
    assert.ok(body.includes(`requirePerm(${need})`), fn);
  }
  const page = (p: string) => src(`src/app/admin/(panel)/${p}`);
  for (const [p, need] of [
    ["chat/page.tsx", '"chat.view"'],
    ["ips/page.tsx", '"ips.view"'],
    ["jobs/page.tsx", '"jobs.view"'],
    ["collector/page.tsx", '"jobs.view"'],
    ["reset/page.tsx", '"resets"'],
    ["rankings/page.tsx", '"rankings.view"'],
    ["rankings/[code]/page.tsx", '"rankings.view"'],
    ["rankings/[code]/hall-of-fame/page.tsx", '"resets"'],
    ["settings/[group]/page.tsx", '"settings.view"'],
    ["privacy/page.tsx", '"settings.view"'],
    ["[entity]/page.tsx", "e.perm.view"],
    ["[entity]/[id]/page.tsx", "e.perm.view"],
  ]) {
    assert.ok(page(p).includes(`requirePerm(${need})`), p);
  }
  // The player pages show chat and IPs by the rights too.
  assert.match(src("src/components/player-history.tsx"), /allowed\(admin, "chat\.view"\)[\s\S]*allowed\(admin, "ips\.view"\)/);
  // The API router and the MCP tools ask the same function.
  assert.match(src("src/lib/admin-api.ts"), /if \(!allowed\(auth\.user, m\.op\.need\)\) throw new ApiFail\(403, "forbidden"/);
});

test("nobody locks the admins out and nobody hands out a right they lack", () => {
  const ops = src("src/lib/admin-ops.ts");
  const save = ops.slice(ops.indexOf("export async function saveEntity"), ops.indexOf("function withValue"));
  assert.match(save, /Number\(row\.acclevel\) >= LEVEL_ADMIN && writes\("acclevel"\) && Number\(form\.get\("acclevel"\)\) < LEVEL_ADMIN && !\(await otherFullAdmin\(String\(id\)\)\)/);
  assert.match(save, /checkPerms\(a, opts\.perms\)/);
  const del = ops.slice(ops.indexOf("export async function deleteEntity"));
  assert.match(del, /!\(await otherFullAdmin\(id\)\)[\s\S]*throw new OpError\("lastadmin"\)/);
  // The rights go with the user: removed on deletion, never inherited by a new user of the name.
  assert.match(del, /DELETE FROM hlstats_Options WHERE keyname IN \(\?, \?\)`, \[permsKey\(id\), nameKey\(id\)\]/);
  assert.match(save, /else if \(id === null \|\| opts\.perms \|\| opts\.role === null\) await writePerms\(a, saved, opts\.perms \?\? \(id === null \? LEVEL80_DEFAULT : await ownPerms\(saved\)\)\)/);
  // A role hands out its rights: only one whose rights the actor has.
  assert.match(save, /if \(opts\.role\) checkPerms\(a, \(await roleFor\(opts\.role\)\)\.perms\)/);
  const set = ops.slice(ops.indexOf("export async function setUserPerms"));
  assert.match(set, /checkPerms\(a, \(await roleFor\(role\)\)\.perms\)/);
  const saveRole = ops.slice(ops.indexOf("export async function saveRole"));
  assert.match(saveRole, /checkPerms\(a, perms\)/);
  // Compared in the database's collation.
  assert.match(ops, /WHERE acclevel >= \? AND username <> \?/);
});

test("admin roles: stored as a reference, never read as more rights", () => {
  // An admin with a role stores only the reference; read as own rights (an
  // older version does that) it is no right at all.
  assert.equal(roleOf(`${ROLE_REF}a1b2c3d4`), "a1b2c3d4");
  assert.deepEqual(parsePerms(`${ROLE_REF}a1b2c3d4`), []);
  assert.equal(roleOf("rankings.view"), null);
  assert.equal(roleOf(`${ROLE_REF}../x`), null);
  assert.ok(isRoleId("a1b2c3d4") && !isRoleId("A1B2C3D4") && !isRoleId("a1b2c3"));
  // Name: trimmed, 1-40 characters, no control characters; a "|" in it stays.
  assert.equal(roleName("  Level   75 "), "Level 75");
  assert.equal(roleName(""), null);
  assert.equal(roleName("x".repeat(41)), null);
  assert.equal(roleName("a\u0007b"), null);
  const r = parseRole("a1b2c3d4", roleValue("Mod | chat", ["players.edit"]));
  assert.deepEqual(r, { id: "a1b2c3d4", name: "Mod | chat", perms: ["players.view", "players.edit"] });
  assert.equal(parseRole("a1b2c3d4", "players.view"), null);
  // Every right and the longest name fit the option column (varchar 255).
  assert.ok(roleValue("x".repeat(40), [...PERMS]).length <= 255);
});

test("display name: its own row per user, hidden, removed with the user", () => {
  assert.equal(nameKey("Dennis "), nameKey("dennis"));
  assert.notEqual(nameKey("dennis"), permsKey("dennis"));
  assert.match(nameKey("x"), /^gamewe_name_[0-9a-f]{32}$/);
  assert.ok(HIDDEN_OPTION_PREFIXES.includes("gamewe_name_"));
  assert.match(src("src/lib/admin-ops.ts"), /keyname IN \(\?, \?\)`, \[permsKey\(id\), nameKey\(id\)\]/);
  // Only the signed-in admin sets their own, checked like a role name.
  const act = src("src/app/admin/actions.ts");
  assert.match(act.slice(act.indexOf("export async function displayNameAction")), /const user = await requireAdmin\(\);[\s\S]*roleName\(raw\)[\s\S]*setDisplayName\(user\.username, name\)/);
});
