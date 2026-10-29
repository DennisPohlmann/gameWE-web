import { createHash, createHmac, randomBytes } from "node:crypto";

// Admin API tokens (Admin → My account → API tokens): format, hashing and
// the stored record. Pure functions (the tests load them); storage and
// checks against the database are in api-tokens.ts.
//
// A token is "gwe_" + 32 random bytes in base64url. Only a keyed hash of it
// is stored: HMAC-SHA-256 under a key derived from ADMIN_SECRET, so a copy
// of the database alone does not allow testing guesses, and a new
// ADMIN_SECRET makes every token unusable (as it signs everybody out). The
// hash is part of the hlstats_Options key (gamewe_apitoken_<hash>), so a
// token is found by one lookup of its hash, never by comparing secrets.

export const TOKEN_PREFIX = "gwe_";
export const OPTION_PREFIX = "gamewe_apitoken_";
// Hex digits of the HMAC in the key (192 bits); key length 64.
const HASH_HEX = 48;
// Characters of the token shown in the list (gwe_ and 8 more).
const DISPLAY = 12;
export const NAME_MAX = 40;
export const MAX_TOKENS_PER_USER = 20;
// Days until a new token expires; 0 = never.
export const EXPIRY_DAYS = [0, 7, 30, 90, 365] as const;
// last used is written at most this often (seconds).
export const TOUCH_EVERY = 300;
// hlstats_Options.value is varchar(255).
const VALUE_MAX = 255;

export type TokenRecord = {
  owner: string; // hlstats_Users.username
  name: string;
  prefix: string; // first characters of the token, for the list
  created: number; // Unix seconds
  expires: number; // Unix seconds, 0 = never
  lastUsed: number; // Unix seconds, 0 = never
};

export function newToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

// The shape of a token: anything else is refused before any lookup.
export function tokenShapeOk(t: string): boolean {
  return /^gwe_[A-Za-z0-9_-]{43}$/.test(t);
}

export function displayPrefix(token: string): string {
  return token.slice(0, DISPLAY);
}

function hmacKey(adminSecret: string): Buffer {
  return createHash("sha256").update(`gamewe-apitoken:${adminSecret}`).digest();
}

// The hlstats_Options key of a token.
export function tokenKey(token: string, adminSecret: string): string {
  return OPTION_PREFIX + createHmac("sha256", hmacKey(adminSecret)).update(token).digest("hex").slice(0, HASH_HEX);
}

// The id of a token in the list and in the revoke form: its hash.
export const tokenId = (key: string) => key.slice(OPTION_PREFIX.length);
export const idOk = (id: string) => new RegExp(`^[0-9a-f]{${HASH_HEX}}$`).test(id);
export const keyOfId = (id: string) => OPTION_PREFIX + id;

// "Authorization: Bearer <token>" only; null for anything else.
export function bearerToken(header: string | null): string | null {
  const m = /^Bearer[ ]+(\S+)[ ]*$/i.exec(header ?? "");
  return m ? m[1] : null;
}

// A token name: trimmed, 1 to NAME_MAX characters, no control characters.
export function tokenName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || Array.from(s).length > NAME_MAX || /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/.test(s)) return null;
  return s;
}

// Expiry in days from a form value; null for a value not offered.
export function expiryDays(v: unknown): number | null {
  const n = Number(v);
  return typeof v === "string" && /^\d{1,3}$/.test(v) && (EXPIRY_DAYS as readonly number[]).includes(n) ? n : null;
}

export function encodeRecord(r: TokenRecord): string | null {
  const s = JSON.stringify({ v: 1, u: r.owner, n: r.name, p: r.prefix, c: r.created, e: r.expires, l: r.lastUsed });
  return s.length <= VALUE_MAX ? s : null;
}

export function decodeRecord(value: string | null | undefined): TokenRecord | null {
  try {
    const d = JSON.parse(value ?? "") as Record<string, unknown>;
    const nums = [d.c, d.e, d.l];
    if (d.v !== 1 || typeof d.u !== "string" || !d.u || typeof d.n !== "string" || typeof d.p !== "string" || nums.some((x) => typeof x !== "number" || !Number.isInteger(x) || x < 0)) {
      return null;
    }
    return { owner: d.u, name: d.n, prefix: d.p, created: d.c as number, expires: d.e as number, lastUsed: d.l as number };
  } catch {
    return null;
  }
}

export function expired(r: TokenRecord, now: number): boolean {
  return r.expires > 0 && r.expires <= now;
}

export function needsTouch(r: TokenRecord, now: number): boolean {
  return now - r.lastUsed >= TOUCH_EVERY;
}

// Owner names compared as the database compares them, roughly: case and
// surrounding spaces do not count (MariaDB's _ci collations, PAD SPACE).
// Used only to remove more tokens rather than fewer.
export const sameOwner = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
