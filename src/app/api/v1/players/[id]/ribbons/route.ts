import { api, publicPlayer } from "@/lib/api";
import { pathId } from "@/lib/api-params";
import { getPlayerRibbons, getRanks, getRibbonClasses, rankFor, ribbonFor } from "@/lib/awards";

// A player's rank (by kills) and ribbons: per award the number of wins and the ribbon class reached.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const [ribbons, classes, ranks] = await Promise.all([getPlayerRibbons(p.playerId), getRibbonClasses(p.game), getRanks(p.game)]);
    const rank = rankFor(p.kills, ranks);
    return {
      id: p.playerId,
      game: p.game,
      rank: rank ? { index: rank.index, name: rank.name, minKills: Number(rank.minimum), nextAt: rank.next === null ? null : Number(rank.next) } : null,
      data: ribbons.map((r) => {
        const c = ribbonFor(Number(r.wins), classes);
        return {
          id: Number(r.awardId),
          code: r.code,
          name: r.name,
          verb: r.verb,
          wins: Number(r.wins),
          ribbon: c ? { class: c.index, name: c.name, level: c.level, maxLevel: c.max } : null,
        };
      }),
    };
  });
}
