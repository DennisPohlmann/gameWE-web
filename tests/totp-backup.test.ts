// Backup codes of TOTP (src/lib/totp-backup.ts, totp.ts, create-admin.mjs).
// Run with `npm test`.
import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { BACKUP_CHARS, BACKUP_CODES, backupCodeInput, backupHash, newBackupCodes } from "../src/lib/totp-backup.ts";

test("ten different codes of the readable characters", () => {
  const codes = newBackupCodes();
  assert.equal(codes.length, BACKUP_CODES);
  assert.equal(new Set(codes).size, BACKUP_CODES);
  for (const c of codes) assert.match(c, /^[a-hj-km-np-z2-9]{5}-[a-hj-km-np-z2-9]{5}$/);
  assert.doesNotMatch(BACKUP_CHARS, /[01ilo]/);
});

test("a code is read however it is typed", () => {
  assert.equal(backupCodeInput("abcde-fghjk"), "abcdefghjk");
  assert.equal(backupCodeInput(" ABCDE FGHJK "), "abcdefghjk");
  assert.equal(backupCodeInput("abcdefghjk"), "abcdefghjk");
  for (const bad of ["", "123456", "abcde-fghj", "abcde-fghjkm", "abcde-fghj1", "abcde-fghjo"]) assert.equal(backupCodeInput(bad), null, bad);
});

test("only an HMAC keyed with ADMIN_SECRET is stored, the same as create-admin writes", () => {
  const h = backupHash("abcdefghjk", "s".repeat(32));
  assert.match(h, /^[0-9a-f]{64}$/);
  assert.notEqual(h, backupHash("abcdefghjk", "t".repeat(32)));
  const key = createHash("sha256").update(`gamewe-totp-backup:${"s".repeat(32)}`).digest();
  assert.equal(h, createHmac("sha256", key).update("abcdefghjk").digest("hex"));
  const script = readFileSync("scripts/create-admin.mjs", "utf8");
  assert.ok(script.includes(`const BACKUP_CHARS = "${BACKUP_CHARS}";`));
  assert.ok(script.includes("update(`gamewe-totp-backup:${adminSecret}`)"));
  assert.ok(script.includes("`gamewe_totpb_${hashName}_${i}`"));
  assert.ok(readFileSync("src/lib/totp.ts", "utf8").includes("`gamewe_totpb_${h}_${i}`"));
});

test("a code is used up by deleting its row, and works for sign-in, confirmation and removing TOTP", () => {
  const totp = readFileSync("src/lib/totp.ts", "utf8");
  assert.match(totp, /DELETE FROM hlstats_Options WHERE keyname IN \(\$\{inList\(keys\.length\)\}\) AND value = \?/);
  assert.match(totp, /return r\.affectedRows > 0;/);
  const auth = readFileSync("src/lib/auth.ts", "utf8");
  assert.equal(auth.match(/secondFactor\(/g)?.length, 2);
  const actions = readFileSync("src/app/admin/actions.ts", "utf8");
  const disable = actions.slice(actions.indexOf("export async function totpDisableAction"));
  assert.match(disable.slice(0, 500), /secondFactor\([\s\S]*removeBackupCodes\(user\)/);
  // New codes need the code from the app, not a backup code.
  const renew = actions.slice(actions.indexOf("export async function totpBackupCodesAction"), actions.indexOf("export async function totpDisableAction"));
  assert.doesNotMatch(renew, /secondFactor/);
  assert.match(readFileSync("src/lib/admin-ops.ts", "utf8"), /removeBackupCodes\(id\)/);
});
