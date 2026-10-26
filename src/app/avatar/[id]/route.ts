import type { NextRequest } from "next/server";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { getPlayer, noProfile } from "@/lib/data";
import { steamIds } from "@/lib/format";
import { getSteamProfile } from "@/lib/steam";

// /avatar/<playerId>: redirects to the player's small Steam avatar (used by
// the player map), 404 if there is none or the player has no public page.
// The browser then loads it from Steam's image servers, so only with the
// visitor's consent to Steam pictures (lib/consent.ts); the answer depends
// on that cookie and is kept by the browser only.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const headers = { "cache-control": "private, max-age=120", vary: "Cookie" };
  if (!parseConsent(req.cookies.get(CONSENT_COOKIE)?.value).steam) return new Response("no consent", { status: 404, headers: { ...headers, "cache-control": "private, no-store" } });
  const m = /^\d{1,10}$/.exec((await params).id);
  const found = m ? await getPlayer(Number(m[0])) : undefined;
  // Hidden players (and bots without profiles) have no avatar either.
  const p = found && !(await noProfile(found, true)) ? found : undefined;
  const ids = steamIds(p?.uniqueId);
  const steam = ids ? await getSteamProfile(ids.steam64) : null;
  const url = steam?.avatarSmall ?? steam?.avatar;
  if (!url) return new Response("not found", { status: 404, headers });
  return new Response(null, { status: 302, headers: { ...headers, location: url, "cache-control": "private, max-age=3600" } });
}
