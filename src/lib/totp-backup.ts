import { createHash, createHmac, randomInt } from "node:crypto";

// Backup codes of TOTP: ten codes made when TOTP is turned on (and anew on
// request), to sign in or remove TOTP without the app. Each works once. They
// are shown once and stored only as an HMAC keyed with ADMIN_SECRET (like
// the TOTP secret, they stop working when it changes); totp.ts keeps them,
// scripts/create-admin.mjs makes them the same way. No imports of the app,
// so the tests can load it directly.

export const BACKUP_CODES = 10;
// No 0/o, 1/l/i: easy to read off a printout.
export const BACKUP_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

export function newBackupCodes(): string[] {
  return Array.from({ length: BACKUP_CODES }, () => {
    const c = Array.from({ length: 10 }, () => BACKUP_CHARS[randomInt(BACKUP_CHARS.length)]).join("");
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}

// "abcde-fghjk" as typed (any case, spaces or dashes), or null.
export function backupCodeInput(input: string): string | null {
  const c = input.toLowerCase().replace(/[\s-]/g, "");
  return c.length === 10 && [...c].every((ch) => BACKUP_CHARS.includes(ch)) ? c : null;
}

export function backupHash(code: string, adminSecret: string): string {
  const k = createHash("sha256").update(`gamewe-totp-backup:${adminSecret}`).digest();
  return createHmac("sha256", k).update(code).digest("hex");
}
