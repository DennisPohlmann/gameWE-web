import "server-only";
import { headers } from "next/headers";
import { basePath } from "./base-path";
import { getSettings } from "./settings";

// Absolute URL of this statistics site, for links that leave it (forum
// signatures). Behind a proxy it follows X-Forwarded-Host/-Proto.
export async function statsOrigin(): Promise<string> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? "http").split(",")[0].trim();
  if (host && /^[A-Za-z0-9.\-:[\]]+$/.test(host) && (proto === "http" || proto === "https")) return `${proto}://${host}${basePath}`;
  return (await getSettings()).siteUrl.replace(/\/$/, "");
}

export async function signatureUrl(playerId: number): Promise<string> {
  return `${await statsOrigin()}/sig/${playerId}.png`;
}
