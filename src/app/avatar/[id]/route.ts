import { getPlayer } from "@/lib/data";
import { steamIds } from "@/lib/format";
import { getSteamProfile } from "@/lib/steam";

// /avatar/<playerId>: redirects to the player's small Steam avatar (used by
// the player map), 404 if there is none.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const m = /^\d{1,10}$/.exec((await params).id);
  const p = m ? await getPlayer(Number(m[0])) : undefined;
  const ids = steamIds(p?.uniqueId);
  const steam = ids ? await getSteamProfile(ids.steam64) : null;
  const url = steam?.avatarSmall ?? steam?.avatar;
  if (!url) return new Response("not found", { status: 404, headers: { "cache-control": "public, max-age=120" } });
  return new Response(null, { status: 302, headers: { location: url, "cache-control": "public, max-age=3600" } });
}
