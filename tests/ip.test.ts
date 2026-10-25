// Game server addresses in the admin: stored in the text form the collector
// looks log packets up by (Go netip, IPv4 unmapped). Run with `npm test`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { canonicalIp } from "../src/lib/ip.ts";

test("addresses are stored in one form", () => {
  const cases: [string, string][] = [
    ["192.0.2.10", "192.0.2.10"],
    ["192.000.002.010", "192.0.2.10"],
    ["0.0.0.0", "0.0.0.0"],
    ["2001:db8::1", "2001:db8::1"],
    ["2001:DB8:0:0:0:0:0:1", "2001:db8::1"],
    ["2001:0db8:0000:0000:0000:0000:0000:0001", "2001:db8::1"],
    ["::ffff:192.0.2.10", "192.0.2.10"],
    ["::FFFF:C000:020A", "192.0.2.10"],
    ["::1", "::1"],
  ];
  for (const [input, want] of cases) assert.equal(canonicalIp(input), want, input);
});

test("anything else is no address", () => {
  for (const s of ["", "256.1.1.1", "1.2.3", "1.2.3.4.5", "1.2.3.4:27015", "example.com", "2001:db8::1::2", ":::", "fe80::1%eth0", "[::1]", "1.2.3.4 ", "' OR 1=1", "1".repeat(64)]) {
    assert.equal(canonicalIp(s), null, s);
  }
});
