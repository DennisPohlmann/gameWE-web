import { api, apiRadar, publicPlayer } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getPlayerHistory, getRadarAverage } from "@/lib/data";

// The radar of the profile: the player's last 14 days (K/D, kills per
// minute, assists per kill, rounds survived and won) against all players of
// the ranking active in them. relative: the player / the average.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const [history, average] = await Promise.all([getPlayerHistory(p.playerId, 14), getRadarAverage(p.game)]);
    return { id: p.playerId, game: p.game, ...apiRadar(history, average) };
  });
}
