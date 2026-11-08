// What the FastDL download sends besides the address (src/lib/fastdl-access.ts,
// scripts/overviews/fastdl.ts). Run with `npm test`.
import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { guardedGet } from "../scripts/overviews/fastdl.ts";
import { accessValueOk, fastdlHeaders, parseHeader } from "../src/lib/fastdl-access.ts";
import { fastdlQueue } from "../src/lib/overview-fastdl.ts";

test("the ranking's fields over the global ones, authentication as one", () => {
  const global = { agent: "GlobalAgent/1", referer: "hl2://203.0.113.5:27015", user: "dl", password: "pw", header: "X-Api-Key: k1" };
  assert.deepEqual(fastdlHeaders(global), { "User-Agent": "GlobalAgent/1", Referer: "hl2://203.0.113.5:27015", Authorization: `Basic ${Buffer.from("dl:pw").toString("base64")}`, "X-Api-Key": "k1" });
  // A ranking with its own token: Bearer, no Basic; the agent and the header stay global.
  const own = fastdlHeaders(global, { token: "abc.def", referer: "https://own.example.org/" });
  assert.equal(own.Authorization, "Bearer abc.def");
  assert.equal(own.Referer, "https://own.example.org/");
  assert.equal(own["User-Agent"], "GlobalAgent/1");
  assert.equal(own["X-Api-Key"], "k1");
  // A token wins over a user of the same level; the global password does not join the ranking's user.
  assert.equal(fastdlHeaders({ token: "t", user: "u" }).Authorization, "Bearer t");
  assert.equal(fastdlHeaders(global, { user: "other" }).Authorization, `Basic ${Buffer.from("other:").toString("base64")}`);
  assert.deepEqual(fastdlHeaders({}, {}), {});
});

test("only harmless values are stored", () => {
  assert.deepEqual(parseHeader("Cookie: a=1; b=2"), ["Cookie", "a=1; b=2"]);
  for (const bad of ["Host: evil.example.org", "authorization: Bearer x", "Transfer-Encoding: chunked", "NoColon", "Bad Name: x", "X-A: \u0007", "X-A:"]) assert.equal(parseHeader(bad), null, bad);
  assert.equal(accessValueOk("user", "a:b"), false);
  assert.equal(accessValueOk("agent", "a\r\nX-Injected: 1"), false);
  assert.equal(accessValueOk("token", "abc def"), false);
  assert.equal(accessValueOk("token", "eyJhbGciOi.J9-_x/+="), true);
  assert.equal(accessValueOk("agent", "x".repeat(256)), false);
  assert.equal(accessValueOk("password", ""), true);
});

test("the queue hands the headers to the download", () => {
  const seen: (Record<string, string> | undefined)[] = [];
  const ask = fastdlQueue((_b, _m, _d, _done, headers) => seen.push(headers), (g) => `/own/${g}`);
  assert.equal(ask("https://a.example.org/", "css", "de_a", undefined, { "User-Agent": "x" }), true);
  assert.deepEqual(seen, [{ "User-Agent": "x" }]);
});

test("the download sends them", async () => {
  let got: IncomingHttpHeaders = {};
  const server = createServer((req, res) => {
    got = req.headers;
    res.end("ok");
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    const { port } = server.address() as AddressInfo;
    const res = await guardedGet(true, 5000, fastdlHeaders({ agent: "Agent/2", referer: "hl2://x", token: "t0k" }))(`http://127.0.0.1:${port}/maps/x.bsp`);
    await res.text();
    assert.equal(got["user-agent"], "Agent/2");
    assert.equal(got.referer, "hl2://x");
    assert.equal(got.authorization, "Bearer t0k");
  } finally {
    server.close();
  }
});
