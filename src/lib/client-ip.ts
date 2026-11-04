import "server-only";
import { headers } from "next/headers";

// The last X-Forwarded-For entry is the one the reverse proxy added itself;
// earlier entries come from the client and could be changed at will. From a
// peer not in TRUSTED_PROXIES the server preload (scripts/access-log.cjs) has
// removed these headers: then Next.js sets the socket address.
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",").pop()?.trim() || h.get("x-real-ip") || "local";
}
