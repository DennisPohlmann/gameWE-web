// FastDL download of maps (scripts/overviews/fastdl.ts, src/lib/overview-fastdl.ts).
// Run with `npm test`.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { bzip2Fixture, zeroBomb } from "./overview-fastdl-fixtures.ts";
import { bunzip2 } from "../scripts/overviews/bzip2.ts";
import { MAP_NAME, downloadMap, guardedGet, isPrivateAddress, readLimited } from "../scripts/overviews/fastdl.ts";
import { fastdlBase, MAP_NAME as SITE_MAP_NAME } from "../src/lib/overview-format.ts";
import { fastdlQueue } from "../src/lib/overview-fastdl.ts";

const bytes = (b: Buffer, status = 200) => new Response(new Uint8Array(b), { status });

test("the script and the site check map names alike", () => {
  assert.equal(MAP_NAME.source, SITE_MAP_NAME.source);
});

test("bzip2: a real file, with its checksum", () => {
  assert.equal(bunzip2(bzip2Fixture.data, 1000).toString(), bzip2Fixture.text);
  const broken = Buffer.from(bzip2Fixture.data);
  broken[broken.length - 12] ^= 0xff;
  assert.throws(() => bunzip2(broken, 1000));
  assert.throws(() => bunzip2(Buffer.from("not bzip2 at all"), 1000), /not a bzip2/);
  assert.throws(() => bunzip2(bzip2Fixture.data.subarray(0, 20), 1000));
});

test("bzip2: a bomb stops at the limit", () => {
  assert.equal(bunzip2(zeroBomb, 20_000_000).length, 20_000_000);
  assert.throws(() => bunzip2(zeroBomb, 1_000_000), /over the limit/);
});

test("download: .bsp.bz2 first, then .bsp", async () => {
  const asked: string[] = [];
  const map = await downloadMap("https://dl.example.org/cstrike", "de_test", async (u) => {
    asked.push(u);
    return u.endsWith(".bz2") ? bytes(Buffer.alloc(0), 404) : bytes(Buffer.from("VBSP"));
  });
  assert.deepEqual(asked, ["https://dl.example.org/cstrike/maps/de_test.bsp.bz2", "https://dl.example.org/cstrike/maps/de_test.bsp"]);
  assert.equal(map.toString(), "VBSP");
  const zipped = await downloadMap("https://dl.example.org/", "de_test", async () => bytes(bzip2Fixture.data));
  assert.equal(zipped.toString(), bzip2Fixture.text);
});

test("download: no map, bad names and bad addresses", async () => {
  const never = async () => {
    throw new Error("asked the network");
  };
  await assert.rejects(downloadMap("https://dl.example.org/", "de_test", async () => bytes(Buffer.alloc(0), 404)), /HTTP 404/);
  for (const name of ["../secret", "a/b", "a\\b", "", ".hidden", "DE_DUST", "a b", "a%2fb", `${"x".repeat(65)}`]) {
    await assert.rejects(downloadMap("https://dl.example.org/", name, never), /bad map name/);
  }
  for (const base of ["file:///etc/", "ftp://dl.example.org/", "https://user:pw@dl.example.org/"]) {
    await assert.rejects(downloadMap(base, "de_test", never), /bad FastDL/);
  }
});

test("download: size limits, by header and while reading", async () => {
  const big = new Response("x", { headers: { "content-length": "999999" } });
  await assert.rejects(readLimited(big, 1000), /larger than/);
  await assert.rejects(readLimited(new Response("x".repeat(2000)), 1000), /larger than/);
  await assert.rejects(downloadMap("https://dl.example.org/", "de_test", async () => bytes(zeroBomb), 1 << 20, 1000), /over the limit/);
  assert.equal((await readLimited(new Response("x".repeat(1000)), 1000)).length, 1000);
});

test("the address of the setting", () => {
  assert.equal(fastdlBase("https://dl.example.org/cstrike"), "https://dl.example.org/cstrike/");
  assert.equal(fastdlBase(" dl.example.org/x/ "), "https://dl.example.org/x/");
  assert.equal(fastdlBase("http://dl.example.org/?a=1#b"), "http://dl.example.org/");
  for (const bad of ["", "   ", "ftp://x/", "file:///etc", "https://u:p@x/", "javascript:alert(1)"]) assert.equal(fastdlBase(bad), "");
});

test("the queue: one at a time, each map once a day, strict names", () => {
  let clock = 0;
  const runs: { map: string; dir: string; done: (ok: boolean) => void }[] = [];
  const ask = fastdlQueue((_b, map, dir, done) => runs.push({ map, dir, done }), (g) => `/own/${g}`, () => clock);
  const B = "https://dl.example.org/";
  assert.equal(ask("", "css", "de_a"), false, "off without an address");
  assert.equal(ask(B, "../x", "de_a"), false);
  assert.equal(ask(B, "css", "../de_a"), false);
  let drawn = 0;
  assert.equal(ask(B, "css", "de_a", () => drawn++), true);
  assert.equal(ask(B, "css", "de_a"), false);
  assert.equal(ask(B, "css", "de_b"), true);
  assert.equal(runs.length, 1, "the second waits");
  assert.equal(runs[0].dir, "/own/css");
  runs[0].done(true);
  assert.equal(drawn, 1);
  assert.equal(runs.length, 2);
  assert.equal(runs[1].map, "de_b");
  runs[1].done(false);
  assert.equal(ask(B, "css", "de_b"), false, "a failure is not tried again at once");
  clock = 25 * 3600_000;
  assert.equal(ask(B, "css", "de_b"), true);
  runs[2].done(false);
  for (let i = 0; i < 40; i++) ask(B, "tf", `m${i}`);
  assert.ok(runs.length <= 4, "busy: the others wait");
});

test("private addresses, also inside IPv6", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "100.64.0.1", "169.254.169.254", "172.16.0.1", "192.168.1.1", "0.0.0.0", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:169.254.169.254", "not an address"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["1.1.1.1", "172.32.0.1", "2606:4700::1111", "::ffff:1.1.1.1"]) assert.equal(isPrivateAddress(ip), false, ip);
});

test("guarded download: the site's own network only when allowed, no redirects", async () => {
  const server = createServer((req, res) => {
    if (req.url === "/moved") res.writeHead(302, { location: "/ok" }).end();
    else if (req.url === "/empty") res.writeHead(204).end();
    else res.writeHead(200, { "content-length": "2" }).end("ok");
  });
  await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
  const { port } = server.address() as AddressInfo;
  try {
    for (const url of [`http://127.0.0.1:${port}/ok`, `http://localhost:${port}/ok`, `http://2130706433:${port}/ok`, `http://[::1]:${port}/ok`]) {
      await assert.rejects(guardedGet(false)(url), /private address/, url);
    }
    const res = await guardedGet(true)(`http://127.0.0.1:${port}/ok`);
    assert.equal(res.status, 200);
    assert.equal((await readLimited(res, 10)).toString(), "ok");
    assert.equal((await guardedGet(true)(`http://127.0.0.1:${port}/empty`)).status, 204);
    await assert.rejects(guardedGet(true)(`http://127.0.0.1:${port}/moved`), /redirect/);
  } finally {
    server.close();
  }
});
