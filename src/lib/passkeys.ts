import "server-only";
import { createHash } from "node:crypto";
import { adminExec, adminQuery, upsert } from "./db";
import { sameOwner } from "./api-token-core";
import { CHUNKS_MAX, decodeRecord, decodeUse, encodeRecord, encodeUse, passkeyHash, type PasskeyRecord } from "./passkey-core";

// Passkeys of the admin accounts in hlstats_Options (never listed on the raw
// settings page, see HIDDEN_OPTION_PREFIXES), written with the admin
// database user like the TOTP secrets:
//   gamewe_passkey_<hash>_<n>   the record (passkey-core.ts), in pieces
//   gamewe_passkeyu_<hash>      last use and counter; written last, so a
//                               passkey only counts once it is complete
//   gamewe_passkeyonly_<user>   "1": this account signs in only with a passkey

const REC = "gamewe_passkey_";
const USE = "gamewe_passkeyu_";
const ONLY = "gamewe_passkeyonly_";

export type Passkey = PasskeyRecord & { hash: string; lastUsed: number; counter: number };

const now = () => Math.floor(Date.now() / 1000);
const set = (key: string, value: string) => adminExec(upsert("hlstats_Options", ["keyname", "value"], ["keyname"], ["value"]), [key, value]);
const prefixed = (p: string) =>
  adminQuery<{ keyname: string; value: string | null }>(`SELECT keyname, value FROM hlstats_Options WHERE LEFT(keyname, ${p.length}) = ?`, [p]);

async function all(): Promise<Passkey[]> {
  const [recs, uses] = await Promise.all([prefixed(REC), prefixed(USE)]);
  const parts = new Map<string, string[]>();
  for (const r of recs) {
    const m = /^gamewe_passkey_([0-9a-f]{48})_(\d+)$/.exec(r.keyname);
    if (!m || Number(m[2]) >= CHUNKS_MAX) continue;
    const p = parts.get(m[1]) ?? [];
    p[Number(m[2])] = r.value ?? "";
    parts.set(m[1], p);
  }
  const out: Passkey[] = [];
  for (const u of uses) {
    const hash = u.keyname.slice(USE.length);
    const use = decodeUse(u.value);
    const p = parts.get(hash);
    const rec = use && p && Array.from(p).every((x) => x !== undefined) ? decodeRecord(p) : null;
    if (rec && passkeyHash(rec.id) === hash) out.push({ ...rec, hash, ...use! });
  }
  return out;
}

// The passkeys of one account (exact name), newest first.
export async function listPasskeys(owner: string): Promise<Passkey[]> {
  return (await all()).filter((p) => p.owner === owner).sort((a, b) => b.created - a.created || a.hash.localeCompare(b.hash));
}

export async function findPasskey(credId: string): Promise<Passkey | null> {
  return (await all()).find((p) => p.id === credId) ?? null;
}

export async function addPasskey(rec: Omit<PasskeyRecord, "created">, counter: number): Promise<"ok" | "duplicate"> {
  const hash = passkeyHash(rec.id);
  if (await findPasskey(rec.id)) return "duplicate";
  const chunks = encodeRecord({ ...rec, created: now() });
  for (const [i, c] of chunks.entries()) await set(`${REC}${hash}_${i}`, c);
  await set(USE + hash, encodeUse(0, counter));
  return "ok";
}

async function remove(hashes: string[]) {
  if (!hashes.length) return;
  await adminExec(`DELETE FROM hlstats_Options WHERE keyname IN (?)`, [hashes.map((h) => USE + h)]);
  const keys = hashes.flatMap((h) => Array.from({ length: CHUNKS_MAX }, (_, i) => `${REC}${h}_${i}`));
  await adminExec(`DELETE FROM hlstats_Options WHERE keyname IN (?)`, [keys]);
}

// Deletes one of the owner's passkeys; null if it is not theirs.
export async function deletePasskey(owner: string, hash: string): Promise<{ name: string } | null> {
  const p = (await listPasskeys(owner)).find((x) => x.hash === hash);
  if (!p) return null;
  await remove([p.hash]);
  return { name: p.name };
}

export async function touchPasskey(hash: string, counter: number) {
  // Only while the passkey still exists (a delete in between wins).
  await adminExec(`UPDATE hlstats_Options SET value = ? WHERE keyname = ?`, [encodeUse(now(), counter), USE + hash]);
}

const onlyKey = (user: string) => ONLY + createHash("sha256").update(user).digest("hex").slice(0, 32);

export async function passkeyOnly(user: string): Promise<boolean> {
  const [row] = await adminQuery<{ value: string }>(`SELECT value FROM hlstats_Options WHERE keyname = ?`, [onlyKey(user)]);
  return row?.value === "1";
}

export async function setPasskeyOnly(user: string, on: boolean) {
  if (on) await set(onlyKey(user), "1");
  else await adminExec(`DELETE FROM hlstats_Options WHERE keyname = ?`, [onlyKey(user)]);
}

// Every passkey of a user name and the passkey-only switch (deleted user, or
// a new user with the name of an old one), compared loosely like the tokens.
export async function purgePasskeys(username: string) {
  await remove((await all()).filter((p) => sameOwner(p.owner, username)).map((p) => p.hash));
  await setPasskeyOnly(username, false);
}
