// Passkeys (lib/passkey-core.ts) against a software authenticator: real
// keys of every offered algorithm, signed the way browsers do it. Plus the
// rules around them in the actions and the sign-in. Run with `npm test`.
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CHUNK, checkAssertion, checkRegistration, decodeRecord, decodeUse, encodeRecord, encodeUse, passkeyHash, passkeyName, rpIdOf, userHandle, type Expect, type PasskeyRecord } from "../src/lib/passkey-core.ts";

const src = (p: string) => readFileSync(p, "utf8");
const b = (x: Buffer | string) => Buffer.from(x).toString("base64url");
const HOST = "stats.example.org";
const CH = b(Buffer.alloc(32, 7));

function keys(alg: number): { pub: KeyObject; priv: KeyObject } {
  const k = alg === -7 ? generateKeyPairSync("ec", { namedCurve: "prime256v1" }) : alg === -8 ? generateKeyPairSync("ed25519") : generateKeyPairSync("rsa", { modulusLength: 2048 });
  return { pub: k.publicKey, priv: k.privateKey };
}

function authData(rp: string, flags: number, counter: number, credId?: Buffer): Buffer {
  const head = Buffer.alloc(37);
  createHash("sha256").update(rp).digest().copy(head);
  head[32] = flags | (credId ? 0x40 : 0);
  head.writeUInt32BE(counter, 33);
  if (!credId) return head;
  const len = Buffer.alloc(2);
  len.writeUInt16BE(credId.length);
  // aaguid of zeros (attestation "none"); the COSE key is not read.
  return Buffer.concat([head, Buffer.alloc(16), len, credId, Buffer.from([0xa0])]);
}

const client = (type: string, o: Partial<{ challenge: string; origin: string; crossOrigin: boolean }> = {}) =>
  b(JSON.stringify({ type, challenge: o.challenge ?? CH, origin: o.origin ?? `https://${HOST}`, crossOrigin: o.crossOrigin ?? false }));

const create: Expect = { challenge: CH, host: HOST, type: "webauthn.create" };
const get: Expect = { challenge: CH, host: HOST, type: "webauthn.get" };

function register(alg: number, credId = Buffer.alloc(32, 1)) {
  const k = keys(alg);
  const r = {
    clientDataJSON: client("webauthn.create"),
    authenticatorData: b(authData(HOST, 0x05, 0, credId)),
    publicKey: b(k.pub.export({ format: "der", type: "spki" })),
    alg,
  };
  return { k, r };
}

function assertion(priv: KeyObject, alg: number, rec: PasskeyRecord, o: { counter?: number; flags?: number; rp?: string; cd?: string; userHandle?: string | null } = {}) {
  const ad = authData(o.rp ?? HOST, o.flags ?? 0x05, o.counter ?? 0);
  const cd = Buffer.from(o.cd ?? client("webauthn.get"), "base64url");
  const data = Buffer.concat([ad, createHash("sha256").update(cd).digest()]);
  const sig = sign(alg === -8 ? null : "sha256", data, priv);
  return { id: rec.id, clientDataJSON: b(cd), authenticatorData: b(ad), signature: b(sig), userHandle: o.userHandle === undefined ? userHandle(rec.owner) : o.userHandle };
}

for (const alg of [-7, -8, -257]) {
  test(`a passkey (alg ${alg}) is registered and signs in`, () => {
    const { k, r } = register(alg);
    const reg = checkRegistration(r, create);
    assert.ok(reg);
    assert.equal(reg.id, b(Buffer.alloc(32, 1)));
    const rec: PasskeyRecord = { owner: "admin", name: "Phone", id: reg.id, key: reg.key, alg: reg.alg, created: 1 };
    assert.deepEqual(checkAssertion(assertion(k.priv, alg, rec), rec, 0, get), { counter: 0 });
    // Another key's signature does not sign in.
    assert.equal(checkAssertion(assertion(keys(alg).priv, alg, rec), rec, 0, get), null);
  });
}

test("registration checks challenge, origin, host, user verification and key", () => {
  const { r } = register(-7);
  assert.ok(checkRegistration(r, create));
  assert.equal(checkRegistration(r, { ...create, challenge: b(Buffer.alloc(32, 8)) }), null, "other challenge");
  assert.equal(checkRegistration(r, get), null, "a sign-in is no registration");
  assert.equal(checkRegistration({ ...r, clientDataJSON: client("webauthn.create", { origin: "https://evil.example" }) }, create), null, "other origin");
  assert.equal(checkRegistration({ ...r, clientDataJSON: client("webauthn.create", { origin: `http://${HOST}` }) }, create), null, "plain http");
  assert.equal(checkRegistration({ ...r, clientDataJSON: client("webauthn.create", { crossOrigin: true }) }, create), null, "in a frame of another site");
  assert.equal(checkRegistration({ ...r, authenticatorData: b(authData("evil.example", 0x05, 0, Buffer.alloc(32, 1))) }, create), null, "other rpId");
  assert.equal(checkRegistration({ ...r, authenticatorData: b(authData(HOST, 0x01, 0, Buffer.alloc(32, 1))) }, create), null, "no user verification");
  assert.equal(checkRegistration({ ...r, authenticatorData: b(authData(HOST, 0x05, 0)) }, create), null, "no credential data");
  assert.equal(checkRegistration({ ...r, alg: -8 }, create), null, "key does not fit the algorithm");
  assert.equal(checkRegistration({ ...r, alg: -999 }, create), null, "algorithm not offered");
  assert.equal(checkRegistration({ ...r, publicKey: b("nonsense") }, create), null, "no key");
  const weak = generateKeyPairSync("rsa", { modulusLength: 1024 }).publicKey.export({ format: "der", type: "spki" });
  assert.equal(checkRegistration({ ...r, alg: -257, publicKey: b(weak) }, create), null, "RSA below 2048 bits");
  // http only on this computer, where browsers allow passkeys without https.
  const local = { ...create, host: "localhost:3000" };
  const lr = { ...r, clientDataJSON: client("webauthn.create", { origin: "http://localhost:3000" }), authenticatorData: b(authData("localhost", 0x05, 0, Buffer.alloc(32, 1))) };
  assert.ok(checkRegistration(lr, local));
});

test("sign-in checks challenge, origin, host, presence, verification, user and counter", () => {
  const { k, r } = register(-7);
  const reg = checkRegistration(r, create)!;
  const rec: PasskeyRecord = { owner: "admin", name: "Phone", id: reg.id, key: reg.key, alg: -7, created: 1 };
  const ok = (o: Parameters<typeof assertion>[3], counter = 0, e = get) => checkAssertion(assertion(k.priv, -7, rec, o), rec, counter, e);
  assert.ok(ok({}));
  assert.equal(ok({}, 0, { ...get, challenge: b(Buffer.alloc(32, 9)) }), null, "used or other challenge");
  assert.equal(ok({ cd: client("webauthn.create") }), null, "a registration is no sign-in");
  assert.equal(ok({ cd: client("webauthn.get", { origin: "https://evil.example" }) }), null, "other origin");
  assert.equal(ok({ rp: "evil.example" }), null, "other rpId");
  assert.equal(ok({ flags: 0x01 }), null, "no user verification");
  assert.equal(ok({ flags: 0x04 }), null, "user not present");
  assert.equal(ok({ userHandle: userHandle("other") }), null, "passkey of another user");
  assert.ok(ok({ userHandle: null }), "no user handle is fine");
  assert.deepEqual(ok({ counter: 5 }, 4), { counter: 5 });
  assert.equal(ok({ counter: 4 }, 4), null, "counter did not grow: copied authenticator");
  assert.equal(ok({ counter: 0 }, 4), null, "counter went back");
  assert.equal(checkAssertion({ ...assertion(k.priv, -7, rec), id: "other" }, rec, 0, get), null, "other credential id");
  const sig = assertion(k.priv, -7, rec);
  assert.equal(checkAssertion({ ...sig, signature: b(Buffer.alloc(70)) }, rec, 0, get), null, "broken signature");
});

test("the stored record survives the split into rows, an RSA key included", () => {
  const { r } = register(-257, Buffer.alloc(200, 3));
  const reg = checkRegistration(r, create)!;
  const rec: PasskeyRecord = { owner: "admin", name: "Windows Hello", id: reg.id, key: reg.key, alg: -257, created: 1_700_000_000 };
  const chunks = encodeRecord(rec);
  assert.ok(chunks.length > 1 && chunks.every((c) => c.length <= CHUNK), "fits hlstats_Options.value");
  assert.deepEqual(decodeRecord(chunks), rec);
  assert.equal(decodeRecord(chunks.slice(1)), null, "a piece missing");
  assert.equal(decodeRecord(['{"v":1}']), null);
  assert.deepEqual(decodeUse(encodeUse(1_700_000_001, 42)), { lastUsed: 1_700_000_001, counter: 42 });
  assert.equal(decodeUse("x"), null);
  assert.ok(`gamewe_passkey_${passkeyHash(rec.id)}_11`.length <= 128, "fits hlstats_Options.keyname");
});

test("names, handles and the rpId", () => {
  assert.equal(passkeyName("  Phone "), "Phone");
  assert.equal(passkeyName(""), null);
  assert.equal(passkeyName("x".repeat(41)), null);
  assert.notEqual(userHandle("admin"), userHandle("Admin"));
  assert.doesNotMatch(Buffer.from(userHandle("admin"), "base64url").toString("latin1"), /admin/);
  assert.equal(rpIdOf("Stats.Example.org:8443"), "stats.example.org");
  assert.equal(rpIdOf("[::1]:3000"), "::1");
});

test("passkey-only stops the password, keeps the last passkey and the recovery turns it off", () => {
  const auth = src("src/lib/auth.ts");
  const login = auth.slice(auth.indexOf("export async function login("), auth.indexOf("export async function changePassword"));
  // After the password check (same work for every answer), before the result
  // of that check is used: a right password is never told apart from a wrong one.
  assert.ok(login.indexOf("verifyPassword(") < login.indexOf("passkeyOnly(") && login.indexOf("passkeyOnly(") < login.indexOf("!check.ok || user.acclevel"));
  const a = src("src/app/admin/actions.ts");
  const del = a.slice(a.indexOf("function deletePasskeyAction"), a.indexOf("function passkeyOnlyAction"));
  assert.ok(del.indexOf("mine.length <= 1") < del.indexOf("deletePasskey("), "the last passkey stays while only passkey is on");
  assert.match(a.slice(a.indexOf("function passkeyOnlyAction")), /length === 0\) redirect/, "only passkey needs one passkey");
  // A new passkey needs the password (and TOTP code) first, like an API token.
  assert.match(a.slice(a.indexOf("function passkeyAddStartAction"), a.indexOf("function passkeyAddAction")), /confirmIdentity\(user\.username/);
  assert.match(a.slice(a.indexOf("function passkeyAddAction")), /takeChallenge\("add", user\.username\)/);
  // The sign-in has the brake of the password.
  assert.match(auth.slice(auth.indexOf("export async function passkeyLogin")), /blocked\(ip\)[\s\S]*fail\(ip\)/);
  // Passkeys are never shown on the raw settings page.
  assert.match(src("src/lib/admin-settings.ts"), /HIDDEN_OPTION_PREFIXES = \[[^\]]*"gamewe_passkey"/);
});
