// Access log for the standalone server, one line per request on stdout in
// the "combined" format plus the response time:
//
//   1.2.3.4 - - [22/Oct/2026:17:59:55 +0000] "GET /css HTTP/1.1" 200 5123 "-" "Mozilla/5.0 ..." 12ms
//
// Loaded with `node -r ./scripts/access-log.cjs server.js`. The client
// address is the last X-Forwarded-For entry (the one the reverse proxy
// added; earlier ones come from the client), otherwise the socket address. ACCESS_LOG=off turns it off; health checks
// (/healthz) are left out unless ACCESS_LOG=all.
"use strict";

const http = require("node:http");

const mode = (process.env.ACCESS_LOG || "on").toLowerCase();
if (mode !== "off" && mode !== "0" && mode !== "false") {
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pad = (n) => String(n).padStart(2, "0");
  const stamp = (d) =>
    `${pad(d.getUTCDate())}/${MONTHS[d.getUTCMonth()]}/${d.getUTCFullYear()}:${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0000`;
  // Quotes and control characters from the client must not break the line.
  const q = (v) => (v ? `"${String(v).replace(/[\x00-\x1f\x7f"\\]/g, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, "0")}`)}"` : '"-"');
  const clientIp = (req) => {
    const fwd = req.headers["x-forwarded-for"];
    const last = typeof fwd === "string" ? (fwd.split(",").pop() ?? "").trim() : "";
    const ip = last || req.headers["x-real-ip"] || req.socket?.remoteAddress || "-";
    return String(ip).replace(/[^0-9A-Za-z.:%-]/g, "") || "-";
  };

  const emit = http.Server.prototype.emit;
  http.Server.prototype.emit = function (event, req, res) {
    if (event === "request" && res && !(mode !== "all" && /\/healthz(\?|$)/.test(req.url || ""))) {
      const start = process.hrtime.bigint();
      let bytes = 0;
      const write = res.write;
      const end = res.end;
      const count = (chunk, enc) => {
        if (chunk && typeof chunk !== "function") bytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), typeof enc === "string" ? enc : "utf8");
      };
      res.write = function (chunk, enc, cb) {
        count(chunk, enc);
        return write.call(this, chunk, enc, cb);
      };
      res.end = function (chunk, enc, cb) {
        count(chunk, enc);
        return end.call(this, chunk, enc, cb);
      };
      res.on("finish", () => {
        const ms = Number((process.hrtime.bigint() - start) / 1000000n);
        process.stdout.write(
          `${clientIp(req)} - - [${stamp(new Date())}] ${q(`${req.method} ${req.url} HTTP/${req.httpVersion}`)} ${res.statusCode} ${bytes || "-"} ${q(req.headers.referer)} ${q(req.headers["user-agent"])} ${ms}ms\n`,
        );
      });
    }
    return emit.apply(this, arguments);
  };
}
