import { api, apiPath, publicPlayer } from "@/lib/api";
import { pagingArg, paged, pathId } from "@/lib/api-params";
import { getPlayerAwardWins } from "@/lib/history";

// The daily awards a player won, newest first.
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const pg = pagingArg(new URL(req.url).searchParams);
    const { rows, total } = await getPlayerAwardWins(p.playerId, pg.limit, pg.offset);
    return paged(
      rows.map((a) => ({ day: String(a.date).slice(0, 10), id: Number(a.awardId), code: a.code, name: a.name, verb: a.verb, value: Number(a.winner_count) })),
      total,
      pg,
      apiPath(`/players/${p.playerId}/awards`),
    );
  });
}
