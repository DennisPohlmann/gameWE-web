import { api, publicPlayer } from "@/lib/api";
import { pathId, share } from "@/lib/api-params";
import { getPlayerTeams } from "@/lib/data";

// How often a player joined each team, with the share of all joins (the
// profile's teams table), most joins first.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const teams = await getPlayerTeams(p.playerId);
    const total = teams.reduce((n, x) => n + Number(x.joined), 0);
    return {
      id: p.playerId,
      game: p.game,
      data: teams.map((x) => ({ id: Number(x.id), name: x.name, joined: Number(x.joined), share: share(x.joined, total) })),
    };
  });
}
