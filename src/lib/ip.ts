// IP addresses of game servers (hlstats_Servers.address). The collector looks
// a log packet's source up by netip's text form (IPv4 as a.b.c.d, IPv4-mapped
// IPv6 unmapped, IPv6 compressed in lower case), so the admin stores exactly
// that form; "010.0.0.1" or "2001:DB8:0::1" would never match a packet and
// would slip past the unique (address, port) key as a second entry.

// The canonical text form of an IPv4 or IPv6 address, or null if s is none.
export function canonicalIp(s: string): string | null {
  const v4 = ipv4(s);
  if (v4) return v4;
  if (!/^[0-9a-fA-F:.]{2,45}$/.test(s) || !s.includes(":")) return null;
  let host: string;
  try {
    // WHATWG URL parsing normalises IPv6 to RFC 5952 (compressed, lower case).
    host = new URL(`http://[${s}]/`).hostname.slice(1, -1);
  } catch {
    return null;
  }
  const mapped = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (mapped) {
    const hi = parseInt(mapped[1], 16);
    const lo = parseInt(mapped[2], 16);
    return [hi >> 8, hi & 255, lo >> 8, lo & 255].join(".");
  }
  return host;
}

function ipv4(s: string): string | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  return parts.every((n) => n <= 255) ? parts.join(".") : null;
}
