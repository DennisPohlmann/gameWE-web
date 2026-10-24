import { api, apiPath, visibleGame } from "@/lib/api";
import { share } from "@/lib/api-params";
import { getRankCounts, getRankedCount, getRanks } from "@/lib/awards";

// The ranks of a ranking (kill thresholds) with the number of ranked players in each.
export function GET(_req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const ranks = await getRanks(game.code);
    const [counts, ranked] = await Promise.all([getRankCounts(game.code, ranks), getRankedCount(game.code)]);
    return {
      game: game.code,
      rankedPlayers: ranked,
      data: ranks.map((r, i) => ({
        index: r.index,
        name: r.name,
        minKills: Number(r.minimum),
        maxKills: r.next === null ? null : Number(r.next) - 1,
        players: counts[i] ?? 0,
        share: share(counts[i] ?? 0, ranked),
        playersUrl: apiPath(`/rankings/${game.code}/ranks/${r.index}/players`),
      })),
    };
  });
}
