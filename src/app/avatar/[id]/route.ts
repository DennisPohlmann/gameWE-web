import { getPlayer, noProfile } from "@/lib/data";
import { steamIds } from "@/lib/format";
import { getSteamProfile } from "@/lib/steam";

// /avatar/<playerId>: redirects to the player's small Steam avatar (used by
// the player map), 404 if there is none or the player has no public page.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = /^\d{1,10}$/.exec((await params).id);
  const found = m ? await getPlayer(Number(m[0])) : undefined;
  // Hidden players (and bots without profiles) have no avatar either.
  const p = found && !(await noProfile(found, true)) ? found : undefined;
  const ids = steamIds(p?.uniqueId);
  const steam = ids ? await getSteamProfile(ids.steam64) : null;
  const url = steam?.avatarSmall ?? steam?.avatar;
  if (!url) return new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=120" } });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "public, max-age=3600" } });
}
