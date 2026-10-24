import { api, apiMap, apiPath, visibleGame } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getMap } from "@/lib/data";

// One map of a ranking with its totals.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    const game = await visibleGame(code);
    const mapId = pathId(id);
    if (!game || !mapId) return null;
    const m = await getMap(mapId);
    if (!m || m.game !== game.code) return null;
    return { game: game.code, ...apiMap(m), playersUrl: apiPath(`/rankings/${game.code}/maps/${m.id}/players`) };
  });
}
