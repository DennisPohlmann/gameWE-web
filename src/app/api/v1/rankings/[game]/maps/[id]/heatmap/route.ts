import { api, visibleGame } from "@/lib/api";
import { optionalEnumArg, pathId } from "@/lib/api-params";
import { getMap } from "@/lib/data";
import { heatLevel, getHeatmap } from "@/lib/heatmap";
import { levelSplit } from "@/lib/map-levels";

// The heatmap of the map page: where killers stood (with the headshot flag)
// and where players died, the newest 3000 positions of each in game units
// (x to the right, y up). Counter-Strike 2 maps with two levels take
// ?level=upper or lower. No players, only positions.
export function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    const game = await visibleGame(code);
    const mapId = pathId(id);
    if (!game || !mapId) return null;
    const m = await getMap(mapId);
    if (!m || String(m.game).trim() !== game.code) return null;
    const split = levelSplit(game.realgame, m.map);
    const level = optionalEnumArg(new URL(req.url).searchParams, "level", ["upper", "lower"] as const);
    const all = await getHeatmap(mapId);
    const h = all && split !== null && level ? heatLevel(all, split, level) : all;
    return {
      game: game.code,
      id: mapId,
      map: m.map,
      levels: split === null ? null : { split, level: level || null },
      bounds: h ? { minX: h.minX, minY: h.minY, width: h.width, height: h.height } : null,
      kills: h ? h.kills : 0,
      deaths: h ? h.deaths : 0,
      killDots: h ? h.killDots.map(([x, y, hs]) => ({ x, y, headshot: hs > 0 })) : [],
      deathDots: h ? h.deathDots.map(([x, y]) => ({ x, y })) : [],
    };
  });
}
