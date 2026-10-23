import "server-only";
import { env } from "./env";
import { createHmac, randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { basePath } from "./base-path";
import { clientIp } from "./client-ip";
import { adminExec, adminQuery } from "./db";
import { checkCode, consumeStep, readSecret } from "./totp";

// Admin accounts are the rows of hlstats_Users (username, password, acclevel).
// New passwords are stored as scrypt hashes; old HLstatsX MD5 hashes still
// work and are replaced by a scrypt hash on the next login. Users with a TOTP
// secret (src/lib/totp.ts) give the current code in a second step: after the
// password a short-lived "gamewe_2fa" cookie (signed under its own prefix, so
// it never works as a session) carries the user to the code form.

export const LEVEL_ADMIN = 100;
export const LEVEL_MIN = 80;
// Site-wide (player pages show admins IPs and chat). An older
// "gamewe_admin" cookie limited to the admin area is no longer read and is
// cleared.
const COOKIE = "gamewe_session";
const OLD_COOKIE = "gamewe_admin";
const SESSION_HOURS = 12;
const PENDING = "gamewe_2fa";
const PENDING_MINUTES = 5;
// Wrong codes per pending login before the password is asked again.
const PENDING_TRIES = 5;

export type AdminUser = { username: string; acclevel: number };

export function adminSecret(): string | null {
  const s = env("ADMIN_SECRET") ?? "";
  return s.length >= 32 ? s : null;
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(pw: string, stored: string): { ok: boolean; legacy: boolean } {
  if (stored.startsWith("scrypt$")) {
    const [, salt, hash] = stored.split("$");
    const want = Buffer.from(hash, "base64");
    const got = scryptSync(pw, Buffer.from(salt, "base64"), want.length, { N: 16384, r: 8, p: 1 });
    return { ok: got.length === want.length && timingSafeEqual(got, want), legacy: false };
  }
  if (/^[0-9a-f]{32}$/i.test(stored)) {
    const got = Buffer.from(createHash("md5").update(pw).digest("hex"));
    const want = Buffer.from(stored.toLowerCase());
    return { ok: timingSafeEqual(got, want), legacy: true };
  }
  return { ok: false, legacy: false };
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

// Simple in-memory brake against password guessing: 10 failures per IP per 15 minutes.
const failures = new Map<string, { n: number; until: number }>();


async function blocked(ip: string) {
  const f = failures.get(ip);
  return !!f && f.n >= 10 && f.until > Date.now();
}

function fail(ip: string) {
  const f = failures.get(ip);
  failures.set(ip, { n: (f && f.until > Date.now() ? f.n : 0) + 1, until: Date.now() + 15 * 60_000 });
}

async function cookieSecure() {
  return (await headers()).get("x-forwarded-proto") === "https" || env("ADMIN_COOKIE_SECURE") === "true";
}

// Step 1: user name and password. "totp": the account has TOTP, the code
// form comes next (loginCode).
export async function login(username: string, password: string): Promise<"ok" | "totp" | "invalid" | "blocked" | "nosecret"> {
  const secret = adminSecret();
  if (!secret) return "nosecret";
  const ip = await clientIp();
  if (await blocked(ip)) return "blocked";

  const [user] = await adminQuery<{ username: string; password: string; acclevel: number }>(
    `SELECT username, password, acclevel FROM hlstats_Users WHERE username = ?`,
    [username],
  );
  const check = user ? verifyPassword(password, user.password) : { ok: false, legacy: false };
  if (!user || !check.ok || user.acclevel < LEVEL_MIN) {
    fail(ip);
    return "invalid";
  }
  if (check.legacy) {
    await adminExec(`UPDATE hlstats_Users SET password = ? WHERE username = ?`, [hashPassword(password), user.username]);
  }
  if ((await readSecret(user.username, secret)) !== null) {
    const payload = Buffer.from(
      JSON.stringify({ u: user.username, exp: Date.now() + PENDING_MINUTES * 60_000, n: randomBytes(9).toString("base64url") }),
    ).toString("base64url");
    (await cookies()).set(PENDING, `${payload}.${sign(`2fa.${payload}`, secret)}`, {
      httpOnly: true,
      sameSite: "strict",
      secure: await cookieSecure(),
      path: `${basePath}/admin`,
      maxAge: PENDING_MINUTES * 60,
    });
    return "totp";
  }
  failures.delete(ip);
  await startSession(user.username, secret);
  return "ok";
}

// The signed-in user changes their own password; the current one is checked
// with the same brake as the sign-in.
export async function changePassword(username: string, current: string, next: string): Promise<"ok" | "wrong" | "short" | "blocked"> {
  const ip = await clientIp();
  if (await blocked(ip)) return "blocked";
  if (next.length < 10 || next.length > 200) return "short";
  const [user] = await adminQuery<{ password: string }>(`SELECT password FROM hlstats_Users WHERE username = ?`, [username]);
  if (!user || !verifyPassword(current, user.password).ok) {
    fail(ip);
    return "wrong";
  }
  await adminExec(`UPDATE hlstats_Users SET password = ? WHERE username = ?`, [hashPassword(next), username]);
  return "ok";
}

const tries = new Map<string, number>();

// The user waiting for the TOTP step, from the gamewe_2fa cookie.
export async function pendingLogin(): Promise<{ user: string; nonce: string } | null> {
  const secret = adminSecret();
  const raw = (await cookies()).get(PENDING)?.value;
  if (!secret || !raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(`2fa.${payload}`, secret));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const d = JSON.parse(Buffer.from(payload, "base64url").toString()) as { u?: string; exp?: number; n?: string };
    if (!d.u || !d.n || !d.exp || d.exp < Date.now() || (tries.get(d.n) ?? 0) >= PENDING_TRIES) return null;
    return { user: d.u, nonce: d.n };
  } catch {
    return null;
  }
}

export async function cancelPendingLogin() {
  (await cookies()).delete({ name: PENDING, path: `${basePath}/admin` });
}

// Step 2: the TOTP code. "expired": no (valid) pending login, start over.
export async function loginCode(code: string): Promise<"ok" | "code" | "expired" | "blocked" | "nosecret"> {
  const secret = adminSecret();
  if (!secret) return "nosecret";
  const ip = await clientIp();
  if (await blocked(ip)) return "blocked";
  const p = await pendingLogin();
  if (!p) {
    await cancelPendingLogin();
    return "expired";
  }
  const [user] = await adminQuery<{ username: string; acclevel: number }>(`SELECT username, acclevel FROM hlstats_Users WHERE username = ?`, [p.user]);
  const totp = user && user.acclevel >= LEVEL_MIN ? await readSecret(user.username, secret) : null;
  const step = totp ? checkCode(totp, code) : null;
  if (!user || step === null || !consumeStep(user.username, step)) {
    fail(ip);
    tries.set(p.nonce, (tries.get(p.nonce) ?? 0) + 1);
    if (tries.size > 10_000) tries.clear();
    return "code";
  }
  failures.delete(ip);
  tries.delete(p.nonce);
  await cancelPendingLogin();
  await startSession(user.username, secret);
  return "ok";
}

async function startSession(username: string, secret: string) {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + SESSION_HOURS * 3600_000 })).toString("base64url");
  (await cookies()).set(COOKIE, `${payload}.${sign(payload, secret)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: await cookieSecure(),
    path: basePath || "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function logout() {
  const jar = await cookies();
  jar.delete({ name: COOKIE, path: basePath || "/" });
  jar.delete({ name: OLD_COOKIE, path: `${basePath}/admin` });
}

export async function currentAdmin(): Promise<AdminUser | null> {
  const secret = adminSecret();
  const raw = (await cookies()).get(COOKIE)?.value;
  if (!secret || !raw) return null;
  const [payload, mac] = raw.split(".");
  if (!payload || !mac) return null;
  const want = Buffer.from(sign(payload, secret));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let data: { u?: string; exp?: number };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (!data.u || !data.exp || data.exp < Date.now()) return null;
  // Re-read the account so a deleted or demoted user loses access at once.
  const [user] = await adminQuery<AdminUser>(`SELECT username, acclevel FROM hlstats_Users WHERE username = ?`, [data.u]);
  return user && user.acclevel >= LEVEL_MIN ? user : null;
}

export async function requireAdmin(level = LEVEL_MIN): Promise<AdminUser> {
  const user = await currentAdmin();
  if (!user) redirect("/admin/login");
  if (user.acclevel < level) redirect("/admin");
  return user;
}
