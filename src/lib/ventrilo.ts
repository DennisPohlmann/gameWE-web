import { createSocket } from "node:dgram";

// Ventrilo 3 status over UDP (the same port as the voice server). Ventrilo
// never published this protocol. This follows the two public
// reimplementations GameQ (src/GameQ/Protocols/Ventrilo.php, LGPL-3.0-or-later)
// and node-gamedig (protocols/ventrilo.js, MIT), whose key tables are
// byte for byte the same; tests/ventrilo.test.ts decodes answers of real
// servers from GameQ's test data. No status password is sent (servers from
// 3.0.3 on answer without one, as GameQ notes).

const hex = (s: string) => Uint8Array.from(Buffer.from(s, "hex"));
const HEAD = hex(
  "80e50e38ba634c9988634cd654b8657ebf8af0178aaa4d0fb72327f6eb12f8ea17b7cf5257cb51cf1b14fd6f8438b52411cf7a757abb7874dcbc42f0173f5eeb7477044e8caf23dc65dfa565dd7df43c4c95bdeb651cf4245d8218fb5086b853e04e36961fb7cbaaafeacb2027302aaeb90740df1275c909829c30805d8f0d09a164ec91d88a501f405df7082af86062a04a8bba4a6d000a933212e5070165f5ffe0aea781d1ba256261b285ad7e9d3f498926e5d5ac9f0ed76e47941684c8ff44ea0440e03311a35b1e82ff7a69e92ffbea9ac67bdbb1ff977656f352c23f0fb6ac77c4bf595e8074bbf2de57624c1aff956dc704a23bc41b72c76c8260d10d",
);
const BODY = hex(
  "828b7f6890e04409193b8e5fc28238236ddb6249526e21df516c763786507d481f65e7526a88aac1322ff7544caa6d7e6da98c0d3fff6c09b3a5afdf9802b4be6d690d4273e43450073079412f083f4273a768faee880e6ea470742216ae3c8114a1da7fd37c487d3f46fb6d9225173626dbdf5a87916fd6cdd4ad4a29dd7d59bd153453b1d85011837966219e875b242f4fd77334a2f709d5d9429df815df0e10cc05043581b2d57ad2a0a57bb875d2350b398f1b440ece66871b64ace1ca67b4ce33db89fed88ecd5892415040cb08e115eef464fe1cee25e721e66cc6a62e5223a720d2d728072314243d45a5c790db77ddea38598932bc003a6d614edb29",
);

// GameQ's request: command 2 (details), one packet, an empty 16-byte
// password field. The test decrypts it.
export const VENT_REQUEST = Buffer.from("56c8f4f960a21ea54dfb03cc514ea11095afb26717678132fb57fd8ed2227203347abb98", "hex");

export type VentPacket = { cmd: number; total: number; num: number; body: Buffer };

// One answer packet: a 20-byte header (two key bytes, then nine big-endian
// 16-bit fields: zero, cmd, id, total length, length, packets, packet
// number, data key, crc) and the data. null when it is not one.
export function ventDecrypt(packet: Buffer): VentPacket | null {
  if (packet.length < 20) return null;
  const h = Buffer.from(packet.subarray(0, 20));
  let off = h[0];
  if (h[1] === 0) return null;
  for (let i = 2; i < 20; i++) {
    h[i] = (h[i] - HEAD[off] - ((i - 2) % 5)) & 0xff;
    off = (off + h[1]) & 0xff;
  }
  const f = (n: number) => h.readUInt16BE(2 + n * 2);
  const [zero, cmd, , , len, total, num] = [0, 1, 2, 3, 4, 5, 6].map(f);
  if (zero !== 0 || total < 1 || total > 32 || num >= total || 20 + len > packet.length) return null;
  const body = Buffer.from(packet.subarray(20, 20 + len));
  off = h[16];
  if (h[17] === 0) return null;
  for (let i = 0; i < body.length; i++) {
    body[i] = (body[i] - BODY[off] - (i % 72)) & 0xff;
    off = (off + h[17]) & 0xff;
  }
  return { cmd, total, num, body };
}

export type VentStatus = {
  name: string;
  version: string;
  // The server needs a password to log in.
  auth: boolean;
  clients: number | null;
  max: number | null;
  channels: number | null;
  uptime: number | null;
};

// "KEY: value" lines; values encode bytes as %XX (e.g. %2C for a comma)
// and are Latin-1. CHANNEL and CLIENT lines are not read.
export function ventParse(data: Buffer): VentStatus {
  const o: Record<string, string> = {};
  for (const line of data.toString("latin1").split("\n")) {
    const m = /^([A-Z]+): ?(.*)$/.exec(line.replace(/[\r\0]+$/, ""));
    if (m && m[1] !== "CHANNEL" && m[1] !== "CLIENT") o[m[1]] = m[2].replace(/%([0-9A-F]{2})/gi, (_, x: string) => String.fromCharCode(parseInt(x, 16)));
  }
  const num = (k: string) => (/^\d{1,10}$/.test(o[k] ?? "") ? Number(o[k]) : null);
  const text = (k: string, max: number) => (o[k] ?? "").replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, max);
  return {
    name: text("NAME", 80),
    version: text("VERSION", 20),
    auth: (o.AUTH ?? "0").trim() !== "0",
    clients: num("CLIENTCOUNT"),
    max: num("MAXCLIENTS"),
    channels: num("CHANNELCOUNT"),
    uptime: num("UPTIME"),
  };
}

// Sends the request and joins the answer packets in their order. Always
// settles: callers share the promise.
export function ventQuery(host: string, port: number, timeoutMs = 4000): Promise<VentStatus> {
  return new Promise((resolve, reject) => {
    const sock = createSocket(host.includes(":") ? "udp6" : "udp4");
    const parts = new Map<number, Buffer>();
    let done = false;
    const finish = (err: Error | null, v?: VentStatus) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      sock.close();
      if (err) reject(err);
      else resolve(v!);
    };
    const timer = setTimeout(() => finish(new Error("timeout")), timeoutMs);
    sock.on("error", (e) => finish(e));
    // connect(): only datagrams from the server itself arrive.
    sock.on("message", (msg) => {
      const p = msg.length <= 2048 ? ventDecrypt(msg) : null;
      // Real servers answer command 2 with command 3 (test fixtures).
      if (!p || p.cmd !== 3) return;
      parts.set(p.num, p.body);
      const all = Array.from({ length: p.total }, (_, i) => parts.get(i));
      if (all.every((b) => b)) finish(null, ventParse(Buffer.concat(all as Buffer[])));
    });
    // Without a callback a failed DNS lookup arrives as "error".
    sock.once("connect", () => sock.send(VENT_REQUEST, (e) => e && finish(e)));
    sock.connect(port, host);
  });
}

// "3.0.6" -> "Ventrilo 3".
export function ventType(version: string): string {
  const major = /^(\d{1,2})\./.exec(version)?.[1];
  return major ? `Ventrilo ${major}` : "Ventrilo";
}
