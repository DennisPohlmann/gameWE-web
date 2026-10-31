// Code step of the admin login: one field at a time, app code or backup
// code (src/lib/login-code.ts, admin/(auth)/login/page.tsx). Run with
// `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { codeMode, codeStepHref } from "../src/lib/login-code.ts";

test("the app code is the default, only use=backup switches", () => {
  assert.equal(codeMode(undefined), "totp");
  assert.equal(codeMode(""), "totp");
  assert.equal(codeMode("totp"), "totp");
  assert.equal(codeMode("Backup"), "totp");
  assert.equal(codeMode(["backup"]), "totp");
  assert.equal(codeMode("backup"), "backup");
});

test("the switch links and the error redirect keep the mode", () => {
  assert.equal(codeStepHref("totp"), "/admin/login?step=code");
  assert.equal(codeStepHref("backup"), "/admin/login?step=code&use=backup");
  assert.equal(codeStepHref("totp", "code"), "/admin/login?step=code&error=code");
  assert.equal(codeStepHref("backup", "code"), "/admin/login?step=code&use=backup&error=code");
});

const page = readFileSync("src/app/admin/(auth)/login/page.tsx", "utf8");
const actions = readFileSync("src/app/admin/actions.ts", "utf8");

test("the code step shows exactly one code field and focuses it", () => {
  const step = page.slice(page.indexOf("{pending ?"), page.indexOf("loginCancelAction}"));
  assert.doesNotMatch(step, /<details/);
  assert.equal(step.match(/name="code"/g)?.length, 2, "one field per branch");
  assert.equal(step.match(/autoFocus/g)?.length, 2);
  assert.match(step, /mode === "backup" \?/);
  assert.match(step, /a\.totpUseBackup/);
  assert.match(step, /a\.totpUseApp/);
});

test("the mode only picks the redirect, the code is checked as before", () => {
  const fn = actions.slice(actions.indexOf("export async function loginCodeAction"), actions.indexOf("export async function loginCancelAction"));
  assert.match(fn, /loginCode\(String\(form\.get\("code"\) \?\? ""\)\)/);
  assert.doesNotMatch(fn, /loginCode\([^)]*use/);
});
