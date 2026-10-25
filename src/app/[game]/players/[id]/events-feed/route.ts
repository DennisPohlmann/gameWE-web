import { overLimit } from "@/lib/api";
import { currentAdmin } from "@/lib/auth";
import { getGame, getPlayer, getPlayerFlags, noProfile } from "@/lib/data";
import { getPlayerGameEvents, PLAYER_EVENTS } from "@/lib/history";
import { getSettings } from "@/lib/settings";

// Requests a client may make a minute (the page asks every 4 seconds; a few
// open tabs fit).
const LIMIT = 60;

// The latest events of one player as JSON, for the live box on the player
// page: kills and deaths, actions by and on the player, team bonuses. The
// same rows the page itself shows, and only where the page exists.
export async function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id: raw } = await params;
  if (!/^[a-z0-9_-]{1,32}$/i.test(game) || !/^[1-9]\d{0,9}$/.test(raw)) return notFound();
  if ((await getSettings()).playerEvents !== "live") return notFound();
  const wait = await overLimit("player-events-feed", LIMIT);
  if (wait) return new Response("rate limit", { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } });
  // Like the ranking pages (layout): a hidden ranking for admins only.
  const known = (await getGame(game)) ?? ((await currentAdmin()) ? await getGame(game, true) : undefined);
  if (!known) return notFound();
  const id = Number(raw);
  const p = await getPlayer(id);
  if (!p || p.game !== game || (await noProfile(p))) return notFound();
  const rows = await getPlayerGameEvents(id, PLAYER_EVENTS);
  const flags = await getPlayerFlags(rows.flatMap((r) => [r.actor, r.other]));
  return Response.json({ rows, flags: Object.fromEntries(flags) }, { headers: { "cache-control": "no-store" } });
}

function notFound() {
  return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
}
