import { api, publicPlayer } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getPlayerNames } from "@/lib/data";

// "YYYY-MM-DD HH:MM:SS" (UTC) as Unix time; null when empty or invalid.
function unixOf(v: string | Date | null): number | null {
  if (!v) return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(`${String(v).replace(" ", "T")}Z`);
  return Number.isFinite(t) ? Math.floor(t / 1000) : null;
}

// The names a player used (the profile's names table, the 20 used last):
// time played and kills under each name, last use.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const names = await getPlayerNames(p.playerId);
    return {
      id: p.playerId,
      game: p.game,
      data: names.map((n) => ({
        name: n.name,
        connectionTime: Number(n.connection_time),
        kills: Number(n.kills),
        deaths: Number(n.deaths),
        headshots: Number(n.headshots),
        uses: Number(n.numuses),
        lastUsed: unixOf(n.lastuse),
      })),
    };
  });
}
