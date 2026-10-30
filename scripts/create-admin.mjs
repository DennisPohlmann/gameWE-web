// Creates an admin user in hlstats_Users, or gives an existing one a new
// password. Prints the generated password once.
//
//   npm run create-admin -- <name>            password only
//   npm run create-admin -- <name> --totp     also a new TOTP key and backup codes (printed as text)
//   npm run create-admin -- <name> --no-totp  also removes the TOTP key and the backup codes
//
// The TOTP key is stored encrypted with ADMIN_SECRET and the backup codes as
// HMACs keyed with it, in the same format as src/lib/totp.ts.
//
// Reads the database settings (MariaDB or PostgreSQL, DB_TYPE) from the
// environment, .env.local or .env.

import { createCipheriv, createHash, createHmac, randomBytes, randomInt, scryptSync } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

for (const f of [".env.local", ".env"]) if (existsSync(f)) process.loadEnvFile(f);
// Same quote handling as src/lib/env.ts (docker --env-file keeps quotes).
for (const [k, v] of Object.entries(process.env)) {
  const m = /^(["'])(.*)\1$/s.exec((v ?? "").trim());
  if (m) process.env[k] = m[2];
}

const args = process.argv.slice(2);
const flags = args.filter((a) => a.startsWith("--"));
const [name] = args.filter((a) => !a.startsWith("--"));
const totp = flags.includes("--totp") ? "new" : flags.includes("--no-totp") ? "remove" : null;
if (!name || name.length > 128 || flags.some((f) => !["--totp", "--no-totp"].includes(f)) || flags.length > 1) {
  console.error("usage: npm run create-admin -- <name> [--totp | --no-totp]");
  process.exit(2);
}
const adminSecret = process.env.ADMIN_SECRET ?? "";
// The same rule as src/lib/admin-secret.ts: placeholders ("change-me...") and
// repeated patterns lock the admin area like a missing secret.
const secretOk =
  adminSecret.length >= 32 && !/change[\s_-]*me/i.test(adminSecret) && new Set(adminSecret).size >= 8;
if (totp === "new" && !secretOk) {
  console.error("--totp needs a random ADMIN_SECRET (at least 32 characters, e.g. openssl rand -hex 32) in the environment or .env");
  process.exit(2);
}
if (!secretOk) {
  console.error("note: ADMIN_SECRET is missing, a placeholder or too weak; the admin area stays locked until it is a random value (openssl rand -hex 32)");
}

// RFC 6238 key: 20 random bytes in base32.
function newSecret() {
  const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const b of randomBytes(20)) bits += b.toString(2).padStart(8, "0");
  return bits.match(/.{5}/g).map((c) => B32[Number.parseInt(c, 2)]).join("");
}

function seal(secret) {
  const key = createHash("sha256").update(`gamewe-totp:${adminSecret}`).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(secret, "utf8"), c.final()]);
  return `v1.${Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url")}`;
}

// Ten backup codes "abcde-fghjk" (no 0/o, 1/l/i), one row each.
const BACKUP_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
function newBackupCodes() {
  return Array.from({ length: 10 }, () => {
    const c = Array.from({ length: 10 }, () => BACKUP_CHARS[randomInt(BACKUP_CHARS.length)]).join("");
    return `${c.slice(0, 5)}-${c.slice(5)}`;
  });
}
function backupHash(code) {
  const key = createHash("sha256").update(`gamewe-totp-backup:${adminSecret}`).digest();
  return createHmac("sha256", key).update(code.replace("-", "")).digest("hex");
}

const hashName = createHash("sha256").update(name).digest("hex").slice(0, 32);
const totpKey = `gamewe_totp_${hashName}`;
const pendingKey = `gamewe_totpp_${hashName}`;
const backupKeys = Array.from({ length: 10 }, (_, i) => `gamewe_totpb_${hashName}_${i}`);
const totpSecret = totp === "new" ? newSecret() : null;
const backupCodes = totpSecret ? newBackupCodes() : [];

const password = randomBytes(12).toString("base64url");
const salt = randomBytes(16);
const hash = `scrypt$${salt.toString("base64")}$${scryptSync(password, salt, 32, { N: 16384, r: 8, p: 1 }).toString("base64")}`;

const e = process.env;
const type = (e.DB_TYPE ?? "mariadb").toLowerCase();
const pg = ["postgres", "postgresql", "pg"].includes(type);
const tlsMode = (e.DB_TLS ?? "off").toLowerCase();
const tls = ["", "off", "disable", "disabled", "false", "0"].includes(tlsMode)
  ? undefined
  : {
      rejectUnauthorized: !["skip-verify", "insecure"].includes(tlsMode),
      ...(e.DB_TLS_CA ? { ca: readFileSync(e.DB_TLS_CA, "utf8") } : {}),
    };
// DB_TABLE_PREFIX as in src/lib/table-prefix.ts: hlstats -> hlstats_Users.
let prefix = (e.DB_TABLE_PREFIX ?? "").trim().replace(/_$/, "") || "hlstats";
if (prefix.length > 16 || !/^[A-Za-z][A-Za-z0-9_]*$/.test(prefix) || prefix.endsWith("_") ||
  (prefix.toLowerCase() !== "hlstats" && prefix.toLowerCase().startsWith("hlstats_")) || prefix.toLowerCase() === "gamewe") {
  console.error(`DB_TABLE_PREFIX "${e.DB_TABLE_PREFIX}": a letter, then letters, digits and _, at most 16 characters`);
  process.exit(2);
}
const users = `${prefix}_Users`;
const options = `${prefix}_Options`;
const conn = {
  host: e.DB_HOST ?? "127.0.0.1",
  port: Number(e.DB_PORT ?? (pg ? 5432 : 3306)),
  user: e.DB_ADMIN_USER || e.DB_USER,
  password: e.DB_ADMIN_USER ? e.DB_ADMIN_PASSWORD : e.DB_PASSWORD,
  database: e.DB_NAME ?? "gamewe",
};

let issuer;
if (pg) {
  const { default: postgres } = await import("pg");
  const db = new postgres.Client({ ...conn, ssl: tls ?? false });
  await db.connect();
  await db.query(
    `INSERT INTO ${users} (username, password, acclevel, playerId) VALUES ($1, $2, 100, 0)
     ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, acclevel = 100`,
    [name, hash],
  );
  const keys = [totpKey, pendingKey, ...backupKeys];
  if (totp) await db.query(`DELETE FROM ${options} WHERE keyname IN (${keys.map((_, i) => `$${i + 1}`).join(", ")})`, keys);
  if (totpSecret) await db.query(`INSERT INTO ${options} (keyname, value) VALUES ($1, $2)`, [totpKey, seal(totpSecret)]);
  for (const [i, c] of backupCodes.entries()) await db.query(`INSERT INTO ${options} (keyname, value) VALUES ($1, $2)`, [backupKeys[i], backupHash(c)]);
  issuer = (await db.query(`SELECT value FROM ${options} WHERE keyname = 'sitename'`)).rows[0]?.value;
  await db.end();
} else {
  const { default: mysql } = await import("mysql2/promise");
  const db = await mysql.createConnection({ ...conn, charset: "utf8mb4", ssl: tls });
  await db.query(
    `INSERT INTO ${users} (username, password, acclevel, playerId) VALUES (?, ?, 100, 0)
     ON DUPLICATE KEY UPDATE password = VALUES(password), acclevel = 100`,
    [name, hash],
  );
  const keys = [totpKey, pendingKey, ...backupKeys];
  if (totp) await db.query(`DELETE FROM ${options} WHERE keyname IN (${keys.map(() => "?").join(", ")})`, keys);
  if (totpSecret) await db.query(`INSERT INTO ${options} (keyname, value) VALUES (?, ?)`, [totpKey, seal(totpSecret)]);
  for (const [i, c] of backupCodes.entries()) await db.query(`INSERT INTO ${options} (keyname, value) VALUES (?, ?)`, [backupKeys[i], backupHash(c)]);
  issuer = (await db.query(`SELECT value FROM ${options} WHERE keyname = 'sitename'`))[0][0]?.value;
  await db.end();
}
console.log(`Admin user "${name}" is ready. Password: ${password}`);
console.log("Change it after the first sign-in under Admin > Users.");
if (totpSecret) {
  issuer = (issuer ?? "").trim() || "gameWE";
  const label = encodeURIComponent(`${issuer}:${name}`);
  console.log("");
  console.log(`TOTP key (enter it in your authenticator app): ${totpSecret.replace(/(.{4})/g, "$1 ").trim()}`);
  console.log(`otpauth://totp/${label}?secret=${totpSecret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`);
  console.log("Signing in now also needs the six-digit code from the app.");
  console.log("");
  console.log("Backup codes (each works once instead of the code from the app; keep them somewhere safe, they are not shown again):");
  for (const c of backupCodes) console.log(`  ${c}`);
} else if (totp === "remove") {
  console.log("TOTP and its backup codes are removed for this user.");
}
