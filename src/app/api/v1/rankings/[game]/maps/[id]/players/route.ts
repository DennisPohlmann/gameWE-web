import { api, apiPath, playerTags, visibleGame } from "@/lib/api";
import { intArg, kpd, pagingArg, paged, pathId, share } from "@/lib/api-params";
import { countMapTop, getMap, getMapTop } from "@/lib/data";

// The best players on one map over the last `days` days, by kills, paged.
export function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game: code, id } = await params;
    const game = await visibleGame(code);
    const mapId = pathId(id);
    if (!game || !mapId) return null;
    const m = await getMap(mapId);
    if (!m || m.game !== game.code) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const days = intArg(q, "days", 30, 1, 90);
    const [rows, total] = await Promise.all([getMapTop(m.id, days, p.limit, p.offset), countMapTop(m.id, days)]);
    const tag = await playerTags(rows.map((r) => r.playerId));
    return paged(
      rows.map((r, i) => ({
        rank: p.offset + i + 1,
        id: Number(r.playerId),
        name: r.name,
        ...tag(r.playerId),
        kills: Number(r.a),
        deaths: Number(r.b),
        headshots: Number(r.c),
        kpd: kpd(r.a, r.b),
        hpk: share(r.c, r.a),
      })),
      total,
      p,
      apiPath(`/rankings/${game.code}/maps/${m.id}/players`),
      { days: days === 30 ? undefined : days },
    );
  });
}
