import { api, playerTags, visibleGame } from "@/lib/api";
import { getAwards, getMostDecorated, getRibbonClasses, getRibbonLeaders, reachedClass } from "@/lib/awards";

// Ribbons (gameME's global awards): per award how many players won it, how
// many reached each ribbon class and who won it most often; and the players
// with the most award wins.
export function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const [awards, classes, leaders, decorated] = await Promise.all([
      getAwards(game.code),
      getRibbonClasses(game.code),
      getRibbonLeaders(game.code),
      getMostDecorated(game.code, 10),
    ]);
    const tag = await playerTags([...[...leaders.values()].map((l) => l.playerId), ...decorated.map((d) => d.playerId)]);
    return {
      game: game.code,
      classes: classes.map((c, i) => ({ index: i, name: c.name, levels: Number(c.maximum), winsPerLevel: Number(c.steps) })),
      data: awards.map((a) => {
        const l = leaders.get(a.awardId);
        return {
          id: Number(a.awardId),
          code: a.code,
          name: a.name,
          verb: a.verb,
          holders: l?.holders ?? 0,
          perClass: classes.map((_, i) => (l ? reachedClass(l.all, i, classes) : 0)),
          leader: l ? { id: Number(l.playerId), name: l.name, ...tag(l.playerId), wins: Number(l.wins) } : null,
        };
      }),
      mostDecorated: decorated.map((d, i) => ({ rank: i + 1, id: Number(d.playerId), name: d.name, ...tag(d.playerId), wins: Number(d.wins), kills: Number(d.kills) })),
    };
  });
}
