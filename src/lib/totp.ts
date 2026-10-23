import "server-only";
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { adminExec, adminQuery, upsert } from "./db";

// Optional TOTP (RFC 6238: SHA-1, 30 s, 6 digits) for admin users. The secret
// sits encrypted with ADMIN_SECRET in hlstats_Options, under a key derived
// from the user name: gamewe_totp_<hash> once active, gamewe_totpp_<hash>
// while it waits for the first code. scripts/create-admin.mjs writes the
// same format.

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
