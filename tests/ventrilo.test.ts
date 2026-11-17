// Ventrilo status query. The fixtures are answers of two real servers from
// GameQ's test data (tests/Protocols/Providers/Ventrilo, LGPL-3.0-or-later),
// one file per answer, packets split by "\n||\n"; the numbers expected are
// those of GameQ's *_result.json. Run with `npm test`.
import assert from "node:assert/strict";
import { createSocket } from "node:dgram";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { VENT_REQUEST, ventDecrypt, ventParse, ventQuery, ventType } from "../src/lib/ventrilo.ts";

const packets = (n: number) => {
  const raw = readFileSync(`tests/fixtures/ventrilo/${n}_response.txt`);
  const out: Buffer[] = [];
  for (let at = 0; ; ) {
    const i = raw.indexOf("\n||\n", at);
    out.push(raw.subarray(at, i < 0 ? raw.length : i));
    if (i < 0) return out;
    at = i + 4;
  }
};

const decode = (list: Buffer[]) => {
  const parts = list.map((p) => ventDecrypt(p)!);
  assert.ok(parts.every((p) => p && p.cmd === 3 && p.total === list.length));
  return ventParse(Buffer.concat(parts.sort((a, b) => a.num - b.num).map((p) => p.body)));
};

test("the request is command 2 with an empty password", () => {
  const p = ventDecrypt(VENT_REQUEST);
  assert.ok(p);
  assert.deepEqual([p.cmd, p.total, p.num], [2, 1, 0]);
  assert.deepEqual([...p.body], new Array(16).fill(0));
});

test("answers of real servers", () => {
  assert.deepEqual(decode(packets(1)), { name: "tan.cleanvoice.ru", version: "3.0.6", auth: false, clients: 14, max: 40, channels: 54, uptime: 2186 });
  assert.deepEqual(decode(packets(2)), { name: "Voice Server", version: "3.0.6", auth: true, clients: 22, max: 150, channels: 32, uptime: 4931211 });
});

test("garbage is no packet", () => {
  assert.equal(ventDecrypt(Buffer.alloc(10)), null);
  assert.equal(ventDecrypt(Buffer.alloc(40)), null);
  const p = Buffer.from(packets(1)[0]);
  p[3] ^= 0xff; // the zero field
  assert.equal(ventDecrypt(p), null);
});

test("parse: %XX, Latin-1, control characters, missing numbers", () => {
  const s = ventParse(Buffer.from("NAME: Caf\xe9%2C Bar\x07\nAUTH: 0\nCLIENTCOUNT: x\nCLIENT: NAME=a\n\0", "latin1"));
  assert.deepEqual(s, { name: "Café, Bar", version: "", auth: false, clients: null, max: null, channels: null, uptime: null });
  assert.equal(ventType("3.0.6"), "Ventrilo 3");
  assert.equal(ventType(""), "Ventrilo");
});

// A local server answering with the packets of fixture 1, last one first.
test("query over UDP joins packets out of order, and times out", async () => {
  const srv = createSocket("udp4");
  srv.on("message", (msg, from) => {
    assert.deepEqual(msg, VENT_REQUEST);
    srv.send(Buffer.from("junk"), from.port, from.address);
    for (const p of packets(1).reverse()) srv.send(p, from.port, from.address);
  });
  await new Promise<void>((r) => srv.bind(0, "127.0.0.1", r));
  const { port } = srv.address();
  try {
    const s = await ventQuery("127.0.0.1", port);
    assert.equal(s.name, "tan.cleanvoice.ru");
    assert.equal(s.clients, 14);
    srv.removeAllListeners("message");
    await assert.rejects(ventQuery("127.0.0.1", port, 300), /timeout/);
  } finally {
    srv.close();
  }
});
