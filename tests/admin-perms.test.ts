// Fine-grained rights of the admins (lib/admin-perms.ts): what level 80
// keeps without stored rights, what a change implies, and that pages,
// actions, API and MCP all check the same rights.
// Run with `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { LEVEL80_DEFAULT, PERMS, PERM_GROUPS, ROLE_PRESETS, allowed, effectivePerms, isPerm, normalizePerms, parsePerms, permMap, permsKey, permsValue } from "../src/lib/admin-perms.ts";
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
  assert.deepEqual(chat, ["adminChat", "adminMe"]);
  const none = tools({ acclevel: 80, perms: [] }, ["read", "write", "mcp"]).map((t) => t.name);
  assert.deepEqual(none, ["adminMe"]);
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
  assert.match(del, /DELETE FROM hlstats_Options WHERE keyname = \?`, \[permsKey\(id\)\]/);
  assert.match(save, /id === null \|\| opts\.perms\)\) await writePerms\(a, saved, opts\.perms \?\? LEVEL80_DEFAULT\)/);
  // Compared in the database's collation.
  assert.match(ops, /WHERE acclevel >= \? AND username <> \?/);
});
