import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminExec, adminQuery, upsert } from "./db";
import { BACKUP_CODES, backupCodeInput, backupHash } from "./totp-backup";

export { BACKUP_CODES, newBackupCodes } from "./totp-backup";

// Optional TOTP (RFC 6238: SHA-1, 30 s, 6 digits) for admin users. The secret
// sits encrypted with ADMIN_SECRET in hlstats_Options, under a key derived
// from the user name: gamewe_totp_<hash> once active, gamewe_totpp_<hash>
// while it waits for the first code. scripts/create-admin.mjs writes the
// same format, and the backup codes (below).

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function newSecret(): string {
  const bytes = randomBytes(20);
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  return bits.match(/.{5}/g)!.map((c) => B32[Number.parseInt(c, 2)]).join("");
}

function decode32(s: string): Buffer {
  let bits = "";
  for (const c of s.replace(/[\s=]/g, "").toUpperCase()) {
    const i = B32.indexOf(c);
    if (i < 0) throw new Error("bad base32");
    bits += i.toString(2).padStart(5, "0");
  }
  return Buffer.from((bits.match(/.{8}/g) ?? []).map((b) => Number.parseInt(b, 2)));
}

function code(secret: string, step: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", decode32(secret)).update(msg).digest();
  const o = h[h.length - 1] & 15;
  return String((h.readUInt32BE(o) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

// The time step the code belongs to (now, or one step either side), or null.
export function checkCode(secret: string, input: string): number | null {
  const want = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(want)) return null;
  const now = Math.floor(Date.now() / 30_000);
  for (const step of [now, now - 1, now + 1]) {
    if (timingSafeEqual(Buffer.from(code(secret, step)), Buffer.from(want))) return step;
  }
  return null;
}

export function otpauthUri(secret: string, user: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${user}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function optionKey(user: string, pending: boolean) {
  return `gamewe_totp${pending ? "p" : ""}_${createHash("sha256").update(user).digest("hex").slice(0, 32)}`;
}

function key(adminSecret: string) {
  return createHash("sha256").update(`gamewe-totp:${adminSecret}`).digest();
}

function seal(secret: string, adminSecret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(adminSecret), iv);
  const ct = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return `v1.${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url")}`;
}

function open(value: string, adminSecret: string): string | null {
  if (!value.startsWith("v1.")) return null;
  try {
    const raw = Buffer.from(value.slice(3), "base64url");
    const d = createDecipheriv("aes-256-gcm", key(adminSecret), raw.subarray(0, 12));
    d.setAuthTag(raw.subarray(12, 28));
    return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

// null if there is none, else the secret ("" if it can no longer be decrypted, e.g. after
// ADMIN_SECRET changed: such an account cannot sign in until it is reset).
export async function readSecret(user: string, adminSecret: string, pending = false): Promise<string | null> {
  const [row] = await adminQuery<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [optionKey(user, pending)]);
  if (!row) return null;
  return open(row.value, adminSecret) ?? "";
}

export async function storeSecret(user: string, secret: string, adminSecret: string, pending: boolean) {
  await adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [optionKey(user, pending), seal(secret, adminSecret)]);
}

export async function removeSecret(user: string, pending: boolean) {
  await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [optionKey(user, pending)]);
}

// Each code works once: the last accepted step per user.
const used = new Map<string, number>();

export function consumeStep(user: string, step: number): boolean {
  if ((used.get(user) ?? -1) >= step) return false;
  used.set(user, step);
  return true;
}

// Backup codes (totp-backup.ts): one hlstats_Options row each,
// gamewe_totpb_<user hash>_<n>; using a code deletes its row.
function backupKeys(user: string): string[] {
  const h = createHash("sha256").update(user).digest("hex").slice(0, 32);
  return Array.from({ length: BACKUP_CODES }, (_, i) => `gamewe_totpb_${h}_${i}`);
}

const inList = (n: number) => Array.from({ length: n }, () => "?").join(", ");

// Replaces the user's backup codes with these (newBackupCodes).
export async function storeBackupCodes(user: string, codes: string[], adminSecret: string) {
  await removeBackupCodes(user);
  const keys = backupKeys(user);
  for (const [i, c] of codes.slice(0, BACKUP_CODES).entries()) {
    await adminExec(`INSERT INTO hlstats_Options (keyname, value) VALUES (?, ?)`, [keys[i], backupHash(backupCodeInput(c) ?? "", adminSecret)]);
  }
}

export async function removeBackupCodes(user: string) {
  const keys = backupKeys(user);
  await adminExec(`DELETE FROM hlstats_Options WHERE keyname IN (${inList(keys.length)})`, keys);
}

export async function countBackupCodes(user: string): Promise<number> {
  const keys = backupKeys(user);
  const [row] = await adminQuery<{ n: number | string }>(`SELECT COUNT(*) AS n FROM hlstats_Options WHERE keyname IN (${inList(keys.length)})`, keys);
  return Number(row?.n ?? 0);
}

// Uses up the backup code: true when it was one of the user's unused codes.
// Deleting its row is the check, so two requests cannot use one code twice.
export async function spendBackupCode(user: string, input: string, adminSecret: string): Promise<boolean> {
  const c = backupCodeInput(input);
  if (!c || !adminSecret) return false;
  const keys = backupKeys(user);
  const r = await adminExec(`DELETE FROM hlstats_Options WHERE keyname IN (${inList(keys.length)}) AND value = ?`, [...keys, backupHash(c, adminSecret)]);
  return r.affectedRows > 0;
}

// The second factor of a sign-in or a sensitive step: the current code from
// the app (each once), or else a backup code. `totp` is the user's secret.
export async function secondFactor(user: string, totp: string, input: string, adminSecret: string): Promise<"code" | "backup" | null> {
  const step = totp ? checkCode(totp, input) : null;
  if (step !== null) return consumeStep(user, step) ? "code" : null;
  return (await spendBackupCode(user, input, adminSecret)) ? "backup" : null;
}
