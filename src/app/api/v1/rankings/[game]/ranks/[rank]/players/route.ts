import { api, apiPath, playerTags, visibleGame } from "@/lib/api";
import { pagingArg, paged } from "@/lib/api-params";
import { getRankCounts, getRankPlayers, getRanks } from "@/lib/awards";

// The ranked players of one rank (by its index in /ranks), by kills, paged.
export function GET(req: Request, { params }: { params: Promise<{ game: string; rank: string }> }) {
  return api(async () => {
    const { game: code, rank: raw } = await params;
    const game = await visibleGame(code);
    if (!game || !/^\d{1,3}$/.test(raw)) return null;
    const ranks = await getRanks(game.code);
    const rank = ranks[Number(raw)];
    if (!rank) return null;
    const p = pagingArg(new URL(req.url).searchParams);
    const [rows, counts] = await Promise.all([getRankPlayers(game.code, rank, p.limit, p.offset), getRankCounts(game.code, ranks)]);
    const tag = await playerTags(rows.map((r) => r.playerId));
    return paged(
      rows.map((r) => ({
        id: Number(r.playerId),
        name: r.name,
        ...tag(r.playerId),
        skill: Number(r.skill),
        kills: Number(r.kills),
        connectionTime: Number(r.connection_time),
        lastEvent: Number(r.last_event),
      })),
      counts[rank.index] ?? 0,
      p,
      apiPath(`/rankings/${game.code}/ranks/${rank.index}/players`),
    );
  });
}
