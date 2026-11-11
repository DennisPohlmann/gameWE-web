// Every secret in the admin interface (password inputs, shown tokens, the
// TOTP key) is masked by default and has the eye button (RevealInput).
// Run with `npm test`.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const files = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(join(dir, e.name)) : e.name.endsWith(".tsx") ? [join(dir, e.name)] : []));
const admin = [...files("src/app/admin"), ...files("src/components/admin")];
const src = (f: string) => readFileSync(f, "utf8");

test("no plain password input in the admin interface", () => {
  for (const f of admin) {
    if (f.endsWith("reveal-input.tsx")) continue;
    assert.doesNotMatch(src(f), /type="password"/, f);
  }
});

test("read-only secrets go through RevealInput", () => {
  for (const f of admin) assert.doesNotMatch(src(f), /<input [^>]*readOnly value=/, f);
  assert.match(src("src/components/admin/api-token-form.tsx"), /<RevealInput \{\.\.\.noAutofill\} show=\{text\.valueShow\}[^>]*readOnly value=\{shown/);
  assert.match(src("src/components/admin/totp-setup.tsx"), /<RevealInput \{\.\.\.noAutofill\} show=\{text\.show\}[^>]*readOnly value=\{\(shown\.key/);
});

test("the eye button is accessible and starts masked", () => {
  const r = src("src/components/admin/reveal-input.tsx");
  assert.match(r, /useState\(false\)/);
  assert.match(r, /type=\{shown \? "text" : "password"\}/);
  assert.match(r, /aria-pressed=\{shown\}/);
  assert.match(r, /aria-label=\{shown \? hide : show\}/);
  const b = src("src/components/admin/backup-codes-form.tsx");
  assert.match(b, /visible \? c : c\.replace/);
  assert.match(b, /aria-pressed=\{visible\}/);
});

test("a generated log token is shown via the eye button, not by changing the type", () => {
  const t = src("src/components/admin/token-generate.tsx");
  assert.doesNotMatch(t, /\.type = "text"/);
  assert.match(t, /aria-controls="\$\{target\}"\]\[aria-pressed="false"\]/);
});

test("the TOTP key, link and QR code are shown once, never from a reload", () => {
  const page = src("src/app/admin/(panel)/account/page.tsx");
  // The page knows only that a setup was started, never the pending key.
  assert.match(page, /started=\{pending !== null\}/);
  assert.doesNotMatch(page, /otpauthUri|QrCode|qrData|value=\{pending/);
  const actions = src("src/app/admin/actions.ts");
  const startFn = actions.slice(actions.indexOf("export async function totpStartAction"), actions.indexOf("export async function totpCancelAction"));
  // Every start makes a new key (no reuse of a pending one) and answers the form, no redirect.
  assert.match(startFn, /const key = newSecret\(\);\n  await storeSecret\(user, key, secret, true\);/);
  assert.doesNotMatch(startFn, /redirect\(|readSecret\(user, secret, true\)/);
  const setup = src("src/components/admin/totp-setup.tsx");
  assert.match(setup, /useActionState\(start, \{\}\)/);
  assert.match(setup, /begun \? text\.gone : text\.off/);
});

test("secrets shown once are dropped when Back/Forward restores the page", () => {
  assert.match(src("src/components/admin/forget-on-restore.ts"), /e\.persisted && forget\(\)/);
  for (const f of ["api-token-form.tsx", "backup-codes-form.tsx", "totp-setup.tsx"]) assert.match(src(`src/components/admin/${f}`), /useForgetOnRestore\(/, f);
});

test("a stored secret is loaded only on click and only for an admin allowed to change it", () => {
  const actions = src("src/app/admin/actions.ts");
  const fn = actions.slice(actions.indexOf("export async function revealSecretAction"));
  assert.match(fn, /^export async function revealSecretAction\(ref: string\): Promise<string> \{\n  await requireAdmin\(\);/);
  // Entity: only a field defined as secret (no other column), at the entity's level.
  assert.match(fn, /f\.name === c && f\.type === "secret"\)\) return "";\n    await requireAdmin\(e\.minLevel\);/);
  // Setting: only a secret setting, at its level; FastDL access: level 100.
  assert.match(fn, /x\.key === a && x\.type === "secret"\);\n    if \(!s\) return "";\n    await requireAdmin\(s\.minLevel \?\? LEVEL_MIN\);/);
  assert.match(fn, /kind === "fastdl" && ACCESS_SECRETS\.includes[^\n]*\n    await requireAdmin\(LEVEL_ADMIN\);/);
  // Never from the environment: only stored values are read.
  assert.doesNotMatch(fn, /env\(|process\.env/);
  const control = src("src/components/admin/secret-control.tsx");
  // Only a stored, editable secret gets the loader; nothing of it is in the page.
  assert.match(control, /load=\{reveal && set && !disabled \? revealSecretAction\.bind\(null, reveal\) : undefined\}/);
  assert.doesNotMatch(control, /defaultValue|value=\{/);
  const input = src("src/components/admin/reveal-input.tsx");
  assert.match(input, /if \(!shown && load && el && !el\.value\)/);
  // Every caller of a stored secret passes its reference.
  assert.match(src("src/app/admin/(panel)/[entity]/[id]/page.tsx"), /reveal=\{isNew \? undefined : `entity:\$\{e\.key\}:\$\{id\}:\$\{f\.name\}`\}/);
  assert.match(src("src/app/admin/(panel)/settings/[group]/page.tsx"), /reveal=\{`setting:\$\{s\.key\}`\}/);
  assert.match(src("src/app/admin/(panel)/rankings/[code]/fastdl-card.tsx"), /reveal=\{`fastdl:\$\{game\}:\$\{f\}`\}/);
});
