import { overLimit } from "@/lib/api";
import { currentAdmin } from "@/lib/auth";
import { getGame, getPlayer, getPlayerFlags, getPlayerFragsCached, noProfile } from "@/lib/data";
import { getSettings } from "@/lib/settings";

// Rows of the table (as on the page) and how many requests a client may make
// a minute (the page asks every 4 seconds; a few open tabs fit).
const PLAYER_FRAGS = 25;
const LIMIT = 60;

// The latest kills and deaths of one player as JSON, for the live table on
// the player page. The same rows the page itself shows: only frags with this
// player as killer or victim, and only where the page exists.
export async function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  const { game, id: raw } = await params;
  if (!/^[a-z0-9_-]{1,32}$/i.test(game) || !/^[1-9]\d{0,9}$/.test(raw)) return notFound();
  if ((await getSettings()).playerEvents !== "live") return notFound();
  const wait = await overLimit("kills-feed", LIMIT);
  if (wait) return new Response("rate limit", { status: 429, headers: { "retry-after": String(wait), "cache-control": "no-store" } });
  // Like the ranking pages (layout): a hidden ranking for admins only.
  const known = (await getGame(game)) ?? ((await currentAdmin()) ? await getGame(game, true) : undefined);
  if (!known) return notFound();
  const id = Number(raw);
  const p = await getPlayer(id);
  if (!p || p.game !== game || (await noProfile(p))) return notFound();
  const rows = (await getPlayerFragsCached(id, PLAYER_FRAGS)).map((f) => ({
    ...f,
    timestamp_id: Number(f.timestamp_id),
    killerId: Number(f.killerId),
    victimId: Number(f.victimId),
    headshot: Number(f.headshot),
  }));
  const flags = await getPlayerFlags(rows.flatMap((f) => [f.killerId, f.victimId]));
  return Response.json({ rows, flags: Object.fromEntries(flags) }, { headers: { "cache-control": "no-store" } });
}

function notFound() {
  return new Response("not found", { status: 404, headers: { "cache-control": "no-store" } });
}
