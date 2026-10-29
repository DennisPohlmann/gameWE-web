import { api, apiPath, publicPlayer } from "@/lib/api";
import { kpd, pageOf, pagingArg, paged, pathId, share, sortArg, sortRows } from "@/lib/api-params";
import { getPlayerMaps, type PlayerMap } from "@/lib/data";

const SORTS = ["kills", "deaths", "headshots", "kpd", "name"] as const;
const key: Record<(typeof SORTS)[number], (m: PlayerMap) => number | string> = {
  kills: (m) => Number(m.kills),
  deaths: (m) => Number(m.deaths),
  headshots: (m) => Number(m.headshots),
  kpd: (m) => Number(m.kills) / Math.max(1, Number(m.deaths)),
  name: (m) => m.map,
};

// A player's kills and deaths per map (from the kill events the database still holds).
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const q = new URL(req.url).searchParams;
    const pg = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "kills", ["name"]);
    const all = sortRows(await getPlayerMaps(p.game, p.playerId, 1000), key[sort], asc, (m) => Number(m.id));
    return paged(
      pageOf(all, pg).map((m) => ({
        id: Number(m.id),
        name: m.map,
        kills: Number(m.kills),
        deaths: Number(m.deaths),
        headshots: Number(m.headshots),
        kpd: kpd(m.kills, m.deaths),
        hpk: share(m.headshots, m.kills),
      })),
      all.length,
      pg,
      apiPath(`/players/${p.playerId}/maps`),
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
