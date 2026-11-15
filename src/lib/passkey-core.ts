import { createHash, createPublicKey, timingSafeEqual, verify } from "node:crypto";

// Passkeys (WebAuthn) for admin sign-in: checking what the browser sends and
// the stored record. Pure functions (the tests load them); storage is in
// passkeys.ts, the ceremonies in auth.ts.
//
// No WebAuthn library: attestation is not checked ("none"), so registration
// only needs the authenticator data and the public key, which the browser
// gives as SPKI (AuthenticatorAttestationResponse.getPublicKey()), and a
// sign-in is one signature check with node:crypto. User verification
// (fingerprint, face, PIN) is required, so a passkey stands for password and
// second factor at once.

// ES256, EdDSA and RS256: what browsers and authenticators make.
export const ALGS = [-7, -8, -257] as const;
export const MAX_PER_USER = 20;
// 1023 bytes is the WebAuthn limit of a credential id.
const ID_MAX = 1023;
// The record is split into rows of hlstats_Options.value (varchar(255)).
export const CHUNK = 255;
export const CHUNKS_MAX = 12;

export const b64u = (b: Uint8Array) => Buffer.from(b).toString("base64url");
export const unb64u = (s: string) => Buffer.from(s, "base64url");

// The part of the hlstats_Options key that names a passkey: a hash of its id.
export function passkeyHash(credId: string): string {
  return createHash("sha256").update(credId).digest("hex").slice(0, 48);
}

// The WebAuthn user handle of an account: not the name itself.
export function userHandle(username: string): string {
  return b64u(createHash("sha256").update(`gamewe-passkey-user:${username}`).digest().subarray(0, 16));
}

// A passkey name: the same rules as an API token's name.
export { tokenName as passkeyName } from "./api-token-core";

export type PasskeyRecord = {
  owner: string; // hlstats_Users.username
  name: string;
  id: string; // credential id, base64url
  key: string; // public key, SPKI DER in base64url
  alg: number;
  created: number; // Unix seconds
};

export function encodeRecord(r: PasskeyRecord): string[] {
  const s = JSON.stringify({ v: 1, o: r.owner, n: r.name, i: r.id, k: r.key, a: r.alg, c: r.created });
  const out: string[] = [];
  for (let i = 0; i < s.length; i += CHUNK) out.push(s.slice(i, i + CHUNK));
  return out;
}

export function decodeRecord(chunks: string[]): PasskeyRecord | null {
  try {
    const d = JSON.parse(chunks.join("")) as Record<string, unknown>;
    if (d.v !== 1 || typeof d.o !== "string" || typeof d.n !== "string" || typeof d.i !== "string" || typeof d.k !== "string") return null;
    if (typeof d.a !== "number" || !(ALGS as readonly number[]).includes(d.a) || typeof d.c !== "number") return null;
    return { owner: d.o, name: d.n, id: d.i, key: d.k, alg: d.a, created: d.c };
  } catch {
    return null;
  }
}

// The usage row: last sign-in (Unix seconds) and the authenticator's counter.
export const encodeUse = (lastUsed: number, counter: number) => `${lastUsed}.${counter}`;
export function decodeUse(v: string | null | undefined): { lastUsed: number; counter: number } | null {
  const m = /^(\d+)\.(\d+)$/.exec(v ?? "");
  return m ? { lastUsed: Number(m[1]), counter: Number(m[2]) } : null;
}

// What the page must match: the host the admin area is reached under
// (rpId = its name without the port).
export type Expect = { challenge: string; host: string; type: "webauthn.create" | "webauthn.get" };

export function rpIdOf(host: string): string {
  return host.replace(/:\d+$/, "").replace(/^\[(.*)\]$/, "$1").toLowerCase();
}

const LOCAL = new Set(["localhost", "127.0.0.1", "::1"]);

function clientDataOk(json: Buffer, e: Expect): boolean {
  let d: { type?: unknown; challenge?: unknown; origin?: unknown; crossOrigin?: unknown };
  try {
    d = JSON.parse(json.toString("utf8"));
  } catch {
    return false;
  }
  if (d.type !== e.type || typeof d.challenge !== "string" || d.crossOrigin === true) return false;
  const want = Buffer.from(e.challenge);
  const got = Buffer.from(d.challenge);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  let o: URL;
  try {
    o = new URL(String(d.origin));
  } catch {
    return false;
  }
  // Browsers only allow passkeys over https (or on this computer).
  return o.host.toLowerCase() === e.host.toLowerCase() && (o.protocol === "https:" || (o.protocol === "http:" && LOCAL.has(rpIdOf(e.host))));
}

type AuthData = { flags: number; counter: number; credId: Buffer | null };

// Authenticator data: rpIdHash (32), flags (1), counter (4), then for a new
// passkey aaguid (16), id length (2) and the id.
function parseAuthData(a: Buffer, host: string): AuthData | null {
  if (a.length < 37) return null;
  const rp = createHash("sha256").update(rpIdOf(host)).digest();
  if (!timingSafeEqual(a.subarray(0, 32), rp)) return null;
  const flags = a[32];
  // User present and user verified.
  if ((flags & 0x01) === 0 || (flags & 0x04) === 0) return null;
  const counter = a.readUInt32BE(33);
  let credId: Buffer | null = null;
  if (flags & 0x40) {
    if (a.length < 55) return null;
    const n = a.readUInt16BE(53);
    if (n < 1 || n > ID_MAX || a.length < 55 + n) return null;
    credId = a.subarray(55, 55 + n);
  }
  return { flags, counter, credId };
}

export type Registration = { clientDataJSON: string; authenticatorData: string; publicKey: string; alg: number };

// A new passkey from navigator.credentials.create(), or null.
export function checkRegistration(r: Registration, e: Expect): { id: string; key: string; alg: number; counter: number } | null {
  if (typeof r?.clientDataJSON !== "string" || typeof r.authenticatorData !== "string" || typeof r.publicKey !== "string") return null;
  if (!(ALGS as readonly number[]).includes(r.alg) || r.publicKey.length > 1024) return null;
  if (!clientDataOk(unb64u(r.clientDataJSON), e)) return null;
  const a = parseAuthData(unb64u(r.authenticatorData), e.host);
  if (!a?.credId) return null;
  try {
    const k = createPublicKey({ key: unb64u(r.publicKey), format: "der", type: "spki" });
    const kind = k.asymmetricKeyType;
    if (!(r.alg === -7 ? kind === "ec" && k.asymmetricKeyDetails?.namedCurve === "prime256v1" : r.alg === -8 ? kind === "ed25519" : kind === "rsa" && (k.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048)) return null;
  } catch {
    return null;
  }
  return { id: b64u(a.credId), key: r.publicKey, alg: r.alg, counter: a.counter };
}

export type Assertion = { id: string; clientDataJSON: string; authenticatorData: string; signature: string; userHandle?: string | null };

// A sign-in with navigator.credentials.get() for this stored passkey: the
// new counter, or null. A counter that does not grow (once it is used)
// means a copied authenticator.
export function checkAssertion(r: Assertion, rec: PasskeyRecord, counter: number, e: Expect): { counter: number } | null {
  if (typeof r?.clientDataJSON !== "string" || typeof r.authenticatorData !== "string" || typeof r.signature !== "string") return null;
  if (r.id !== rec.id) return null;
  if (r.userHandle && r.userHandle !== userHandle(rec.owner)) return null;
  const cd = unb64u(r.clientDataJSON);
  if (!clientDataOk(cd, e)) return null;
  const raw = unb64u(r.authenticatorData);
  const a = parseAuthData(raw, e.host);
  if (!a) return null;
  const data = Buffer.concat([raw, createHash("sha256").update(cd).digest()]);
  let ok = false;
  try {
    const key = createPublicKey({ key: unb64u(rec.key), format: "der", type: "spki" });
    ok = verify(rec.alg === -8 ? null : "sha256", data, key, unb64u(r.signature));
  } catch {
    return null;
  }
  if (!ok) return null;
  if ((a.counter || counter) && a.counter <= counter) return null;
  return { counter: a.counter };
}
