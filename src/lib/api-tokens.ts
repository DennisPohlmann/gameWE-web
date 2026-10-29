import "server-only";
import { LEVEL_MIN, adminSecret, type AdminUser } from "./auth";
import { adminExec, adminQuery, upsert } from "./db";
import {
  MAX_TOKENS_PER_USER,
  OPTION_PREFIX,
  decodeRecord,
  displayPrefix,
  encodeRecord,
  expired,
  idOk,
  keyOfId,
  needsTouch,
  newToken,
  sameOwner,
  tokenId,
  tokenKey,
  tokenShapeOk,
  type TokenRecord,
} from "./api-token-core";

// Admin API tokens in hlstats_Options (gamewe_apitoken_<hash>, never listed
// on the raw settings page, see HIDDEN_OPTION_PREFIXES), written with the
// admin database user like the TOTP secrets. Created and revoked only on the
// signed-in user's own account page; the API itself cannot manage tokens.

export type TokenInfo = { id: string; name: string; prefix: string; created: number; expires: number; lastUsed: number };
export type TokenAuth = { user: AdminUser; token: { id: string; name: string; prefix: string } };

const now = () => Math.floor(Date.now() / 1000);
const set = (key: string, value: string) => adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, value]);

async function allRows(): Promise<{ key: string; rec: TokenRecord | null }[]> {
  const rows = await adminQuery<{ keyname: string; value: string | null }>(
    `SELECT keyname, value FROM hlstats_Options WHERE LEFT(keyname, ${OPTION_PREFIX.length}) = ?`,
    [OPTION_PREFIX],
  );
  return rows.map((r) => ({ key: r.keyname, rec: decodeRecord(r.value) }));
}

// The tokens of one user, newest first.
export async function listTokens(owner: string): Promise<TokenInfo[]> {
  return (await allRows())
    .filter((r): r is { key: string; rec: TokenRecord } => !!r.rec && r.rec.owner === owner)
    .map(({ key, rec }) => ({ id: tokenId(key), name: rec.name, prefix: rec.prefix, created: rec.created, expires: rec.expires, lastUsed: rec.lastUsed }))
    .sort((a, b) => b.created - a.created || a.id.localeCompare(b.id));
}

// A new token for `owner`; the plain token is returned once and never stored.
export async function createToken(owner: string, name: string, days: number): Promise<{ token: string } | { error: "nosecret" | "limit" | "long" }> {
  const secret = adminSecret();
  if (!secret) return { error: "nosecret" };
  if ((await listTokens(owner)).length >= MAX_TOKENS_PER_USER) return { error: "limit" };
  const token = newToken();
  const t = now();
  const value = encodeRecord({ owner, name, prefix: displayPrefix(token), created: t, expires: days ? t + days * 86400 : 0, lastUsed: 0 });
  if (!value) return { error: "long" };
  await set(tokenKey(token, secret), value);
  return { token };
}

// Revokes one of the owner's tokens at once; false if it is not theirs.
export async function revokeToken(owner: string, id: string): Promise<{ name: string } | null> {
  if (!idOk(id)) return null;
  const [row] = await adminQuery<{ value: string | null }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [keyOfId(id)]);
  const rec = decodeRecord(row?.value);
  if (!rec || rec.owner !== owner) return null;
  await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [keyOfId(id)]);
  return { name: rec.name };
}

// Removes every token of a user name (deleted user, or a new user with the
// name of an old one), compared loosely so none is left behind.
export async function purgeTokens(username: string): Promise<number> {
  const keys = (await allRows()).filter((r) => r.rec && sameOwner(r.rec.owner, username)).map((r) => r.key);
  if (keys.length) await adminExec(`DELETE FROM hlstats_Options WHERE keyname IN (?)`, [keys]);
  return keys.length;
}

// The admin a bearer token stands for, or null: unknown, revoked or expired
// token, no ADMIN_SECRET, or the owner no longer exists with admin rights
// (re-read on every request, so a deleted or demoted admin's tokens stop at
// once). The owner must match exactly, so a later account whose name only
// compares equal in the database's collation never inherits a token.
export async function authenticate(token: string): Promise<TokenAuth | null> {
  const secret = adminSecret();
  if (!secret || !tokenShapeOk(token)) return null;
  const key = tokenKey(token, secret);
  const [row] = await adminQuery<{ value: string | null }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [key]);
  const rec = decodeRecord(row?.value);
  const t = now();
  if (!rec || expired(rec, t)) return null;
  const [user] = await adminQuery<AdminUser>(`SELECT username, acclevel FROM hlstats_Users WHERE username = ?`, [rec.owner]);
  if (!user || user.username !== rec.owner || Number(user.acclevel) < LEVEL_MIN) return null;
  if (needsTouch(rec, t)) {
    const value = encodeRecord({ ...rec, lastUsed: t });
    // Only while the token still exists (a revoke in between wins).
    if (value) await adminExec(`UPDATE hlstats_Options SET value = ? WHERE keyname = ?`, [value, key]).catch(() => undefined);
  }
  return { user: { username: user.username, acclevel: Number(user.acclevel) }, token: { id: tokenId(key), name: rec.name, prefix: rec.prefix } };
}
