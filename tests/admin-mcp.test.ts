// Token scopes (read, write, mcp) and the MCP server of the admin API
// (/api/v1/admin/mcp): the scopes a form may choose, tokens from before
// scopes, which methods need which scope, the JSON-RPC messages, the tools
// (read operations only, by admin level) and their arguments. Run with
// `npm test`.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CONFIRM_SECONDS, MCP_VERSIONS, RpcError, canonical, codeUnused, confirmCode, confirmOk, initializeResult, originOk, rpcHttpStatus, rpcMessage, toolCall, tools } from "../src/lib/admin-mcp.ts";
import { decodeRecord, encodeRecord, mcpWithoutExpiry, scopeFor, tokenScopes } from "../src/lib/api-token-core.ts";
import { adminOps } from "../src/lib/openapi-admin.ts";
import { LEVEL80_DEFAULT, allowed, type PermUser } from "../src/lib/admin-perms.ts";

const FULL: PermUser = { acclevel: 100 };
// A level 80 admin without stored rights: what level 80 always had.
const OLD80: PermUser = { acclevel: 80, perms: LEVEL80_DEFAULT };

const rpcCode = (f: () => unknown) => {
  try {
    f();
  } catch (e) {
    assert.ok(e instanceof RpcError);
    return e.code;
  }
  assert.fail("no error");
};

test("scopes: read or write needed (also with mcp), nothing unknown", () => {
  assert.deepEqual(tokenScopes(["read"]), ["read"]);
  assert.deepEqual(tokenScopes(["mcp", "read"]), ["read", "mcp"], "in a fixed order");
  assert.deepEqual(tokenScopes(["write", "mcp"]), ["write", "mcp"]);
  assert.deepEqual(tokenScopes(["write", "read", "mcp"]), ["read", "write", "mcp"]);
  assert.deepEqual(tokenScopes(["write"]), ["write"]);
  for (const bad of [[], ["mcp"], ["admin"], ["read", "mcp_write"], ["read", "READ"], ["read", 1]]) assert.equal(tokenScopes(bad), null, JSON.stringify(bad));
});

test("scopes: GET reads, every other method writes", () => {
  assert.equal(scopeFor("GET"), "read");
  for (const m of ["POST", "PUT", "PATCH", "DELETE"]) assert.equal(scopeFor(m), "write");
});

test("scopes: stored with the token; a token from before scopes keeps read and write, no mcp", () => {
  const r = { owner: "admin", name: "ci", scopes: tokenScopes(["read", "mcp"])!, prefix: "gwe_abcdefgh", created: 1, expires: 0, lastUsed: 0 };
  assert.deepEqual(decodeRecord(encodeRecord(r)), r);
  const old = JSON.stringify({ v: 1, u: "admin", n: "ci", p: "gwe_abcdefgh", c: 1, e: 0, l: 0 });
  assert.deepEqual(decodeRecord(old)?.scopes, ["read", "write"]);
  assert.match(encodeRecord(r)!, /^\{"v":2,/, "a web from before scopes (v 1 only) refuses it");
  for (const s of ["", "mcp", "root", 3, undefined]) assert.equal(decodeRecord(JSON.stringify({ v: 2, u: "a", n: "", s, p: "", c: 0, e: 0, l: 0 })), null, String(s));
});

test("the API checks the scope before the level, and MCP needs mcp", () => {
  const api = readFileSync("src/lib/admin-api.ts", "utf8");
  assert.ok(api.indexOf("insufficient_scope") < api.indexOf("needs admin level"), "scope checked first");
  assert.match(api, /if \(!token\.scopes\.includes\("mcp"\)\) return error\(403, "insufficient_scope"/);
  // A writing tool runs only with a valid, unused confirmation.
  const call = api.slice(api.indexOf('case "tools/call"'), api.indexOf("default:", api.indexOf('case "tools/call"')));
  const run = call.indexOf("handlers[call.op.handler]");
  assert.ok(call.indexOf("confirmOk(") > 0 && call.indexOf("confirmOk(") < call.indexOf("codeUnused(") && call.indexOf("codeUnused(") < run);
  assert.match(call, /if \(call\.confirmation === undefined\) \{\s*log\.confirmation = "asked";\s*return out\(false/);
  // Every MCP request is logged, as one JSON line.
  assert.match(api, /const res = await mcp\(req, method, actor, auth\.token, log\);\s*log\.status = res\.status;\s*console\.info\(JSON\.stringify\(log\)\);/);
  // MCP only after the token was authenticated and both rate limits counted.
  assert.ok(api.indexOf("await mcp(") > api.indexOf('overLimit("admin-api-token", RATE, auth.token.id)'));
});

test("mcp: one JSON-RPC 2.0 message, no batches", () => {
  assert.deepEqual(rpcMessage({ jsonrpc: "2.0", id: 1, method: "ping" }), { id: 1, method: "ping", params: undefined });
  assert.equal(rpcMessage({ jsonrpc: "2.0", method: "notifications/initialized" }).id, undefined);
  assert.equal(rpcCode(() => rpcMessage([{ jsonrpc: "2.0", id: 1, method: "ping" }])), -32600);
  assert.equal(rpcCode(() => rpcMessage({ id: 1, method: "ping" })), -32600);
  assert.equal(rpcCode(() => rpcMessage({ jsonrpc: "2.0", id: 1.5, method: "ping" })), -32600);
  assert.equal(rpcCode(() => rpcMessage({ jsonrpc: "2.0", id: 1, method: "ping", params: [1] })), -32602);
  assert.equal(rpcCode(() => rpcMessage(null)), -32600);
});

test("mcp: initialize answers the client's version if known, else the newest", () => {
  assert.equal(initializeResult("2025-06-18", "1").protocolVersion, "2025-06-18");
  assert.equal(initializeResult("1999-01-01", "1").protocolVersion, MCP_VERSIONS[0]);
  assert.deepEqual(initializeResult(undefined, "1.2.3").capabilities, { tools: { listChanged: false } });
});

const R = ["read", "mcp"];
const W = ["write", "mcp"];
const RW = ["read", "write", "mcp"];
const OWN = ["adminMyNotificationTest", "adminMyNotifications", "adminSetMyNotifications"];

test("mcp: one tool per operation, GET with read, the others with write, by level", () => {
  const ids = (ops: typeof adminOps) => ops.map((o) => o.operationId).sort();
  const names = (s: string[], user: PermUser = FULL) => tools(user, s).map((t) => t.name).sort();
  assert.deepEqual(names(R), ids(adminOps.filter((o) => o.method === "GET")));
  assert.deepEqual(names(W), ids(adminOps.filter((o) => o.method !== "GET")));
  assert.deepEqual(names(RW), ids(adminOps));
  const all = tools(FULL, RW);
  assert.ok(all.every((t) => /^[A-Za-z0-9_.-]{1,128}$/.test(t.name)));
  for (const t of all) {
    const w = adminOps.find((o) => o.operationId === t.name)!.method !== "GET";
    assert.equal(t.annotations.readOnlyHint, !w, t.name);
    assert.equal("confirmation" in t.inputSchema.properties, w, t.name);
    if (w) assert.equal(t.annotations.destructiveHint, true, t.name);
  }
  const restricted = names(RW, OLD80);
  assert.ok(restricted.length < all.length, "level 80 sees fewer tools");
  for (const op of adminOps.filter((o) => !allowed(OLD80, o.need))) assert.ok(!restricted.includes(op.operationId), op.operationId);
  // Only what the rights reach: chat alone gives the chat tool, adminMe and the own notifications.
  assert.deepEqual(names(RW, { acclevel: 80, perms: ["chat.view"] }), ["adminChat", "adminMe", ...OWN]);
  assert.deepEqual(all.find((t) => t.name === "adminGetRanking")!.inputSchema.required, ["code"]);
  assert.deepEqual(all.find((t) => t.name === "adminUpdateServer")!.inputSchema.required, ["id", "body"]);
});

test("mcp: a call goes through the router with the REST checks", () => {
  const c = toolCall("adminGetRanking", { code: "css" }, FULL, R);
  assert.equal(c.op.operationId, "adminGetRanking");
  assert.deepEqual(c.params, { code: "css" });
  const list = toolCall("adminListServers", { page: 2, q: "de" }, FULL, R);
  assert.equal(list.query.get("page"), "2");
  assert.equal(list.query.get("q"), "de");
  const u = toolCall("adminUpdateServer", { id: 3, body: { name: "x" }, confirmation: "1.a" }, FULL, W);
  assert.deepEqual([u.params, u.body, u.args, u.confirmation], [{ id: "3" }, { name: "x" }, { id: 3, body: { name: "x" } }, "1.a"]);
  assert.equal(rpcCode(() => toolCall("adminGetRanking", { code: "../x" }, FULL, R)), -32602, "path shape checked");
  assert.equal(rpcCode(() => toolCall("adminGetRanking", {}, FULL, R)), -32602, "missing argument");
  assert.equal(rpcCode(() => toolCall("adminGetRanking", { code: "css", x: 1 }, FULL, R)), -32602, "unknown argument");
  assert.equal(rpcCode(() => toolCall("adminGetRanking", { code: "css", body: {} }, FULL, RW)), -32602, "no body on a read");
  assert.equal(rpcCode(() => toolCall("adminGetRanking", { code: "css", confirmation: "x" }, FULL, RW)), -32602, "no confirmation on a read");
  assert.equal(rpcCode(() => toolCall("adminGetRanking", { code: { a: 1 } }, FULL, R)), -32602);
  assert.equal(rpcCode(() => toolCall("adminDeleteRanking", { code: "css" }, FULL, R)), -32602, "no writing tools without write");
  assert.equal(rpcCode(() => toolCall("adminGetRanking", { code: "css" }, FULL, W)), -32602, "no reading tools without read");
  assert.equal(rpcCode(() => toolCall("adminGetRanking", { code: "css" }, { acclevel: 80, perms: ["chat.view"] }, RW)), -32602, "no rankings without rankings.view");
});

test("mcp: a confirmation fits only its token, tool and arguments, for 5 minutes", () => {
  const secret = "0123456789abcdef0123456789abcdef-test-only";
  const args = { id: 3, body: { name: "x", port: 27015 } };
  const code = confirmCode(secret, "tok1", "adminUpdateServer", args, 1000);
  assert.ok(confirmOk(code, secret, "tok1", "adminUpdateServer", { body: { port: 27015, name: "x" }, id: 3 }, 1000), "key order does not count");
  assert.ok(confirmOk(code, secret, "tok1", "adminUpdateServer", args, 1000 + CONFIRM_SECONDS));
  assert.equal(confirmOk(code, secret, "tok1", "adminUpdateServer", args, 1001 + CONFIRM_SECONDS), false, "expired");
  assert.equal(confirmOk(code, secret, "tok2", "adminUpdateServer", args, 1000), false, "other token");
  assert.equal(confirmOk(code, secret, "tok1", "adminDeleteServer", args, 1000), false, "other tool");
  assert.equal(confirmOk(code, secret, "tok1", "adminUpdateServer", { id: 3, body: { name: "y", port: 27015 } }, 1000), false, "other arguments");
  assert.equal(confirmOk(code, `${secret}x`, "tok1", "adminUpdateServer", args, 1000), false, "other ADMIN_SECRET");
  const [exp, mac] = code.split(".");
  assert.equal(confirmOk(`${Number(exp) + 3600}.${mac}`, secret, "tok1", "adminUpdateServer", args, 1000), false, "expiry is signed");
  for (const bad of ["", "x", `${exp}.`, `${exp}.${mac}x`, `-1.${mac}`]) assert.equal(confirmOk(bad, secret, "tok1", "adminUpdateServer", args, 1000), false, bad);
  assert.equal(canonical({ b: [1, { d: 1, c: 2 }], a: null }), '{"a":null,"b":[1,{"c":2,"d":1}]}');
});

test("mcp: requests from web pages are refused", () => {
  assert.ok(originOk(null), "no Origin: not a browser");
  assert.equal(originOk("https://evil.example"), false, "another site, or DNS rebinding with Host = evil.example");
  assert.equal(originOk("https://stats.example.org"), false, "also this site's own pages");
  assert.equal(originOk("null"), false);
});

test("mcp: a confirmation is taken only once", () => {
  const secret = "0123456789abcdef0123456789abcdef-test-only";
  const a = confirmCode(secret, "tok1", "adminDeleteServer", { id: 1 }, 5000);
  const b = confirmCode(secret, "tok1", "adminDeleteServer", { id: 2 }, 5000);
  assert.ok(codeUnused(a, 5000));
  assert.equal(codeUnused(a, 5001), false, "a second time");
  assert.ok(codeUnused(b, 5001), "another code still works");
});

test("mcp: an invalid JSON-RPC message gets HTTP 400, an error of a valid one 200", () => {
  assert.equal(rpcHttpStatus(-32600), 400);
  assert.equal(rpcHttpStatus(-32700), 400);
  assert.equal(rpcHttpStatus(-32601), 200);
  assert.equal(rpcHttpStatus(-32602), 200);
  assert.equal(rpcCode(() => rpcMessage({ jsonrpc: "2.0", id: null, method: "ping" })), -32600, "id null");
});

test("tokens for MCP need an expiry", () => {
  assert.ok(mcpWithoutExpiry(["read", "mcp"], 0));
  assert.equal(mcpWithoutExpiry(["read", "mcp"], 30), false);
  assert.equal(mcpWithoutExpiry(["read", "write"], 0), false, "without mcp: never stays possible");
});
