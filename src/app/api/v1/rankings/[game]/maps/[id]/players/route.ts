import { api, apiPath, playerTags, visibleGame } from "@/lib/api";
import { bad, intArg, kpd, pagingArg, paged, pathId, share, sortArg } from "@/lib/api-params";
import { countMapKillers, countMapTop, getMap, getMapGgWins, getMapPlayerTable, getMapTop } from "@/lib/data";
import { MAP_SORTS } from "@/lib/map-table";

// The players with a kill on one map, as the website's map page: all time,
// sortable (kills by default), with each one's place in the ranking and,
// in GunGame rankings, the GunGame wins on the map. With `days` only the
// last days (1-90), by kills.
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
    const days = q.get("days") === null ? null : intArg(q, "days", 30, 1, 90);
    const path = apiPath(`/rankings/${game.code}/maps/${m.id}/players`);
    if (days !== null) {
      // The last days are listed by kills only.
      if (q.get("sort") !== null || q.get("order") !== null) throw bad("invalid sort: days lists by kills only");
      const [rows, total] = await Promise.all([getMapTop(m.id, days, p.limit, p.offset), countMapTop(m.id, days)]);
      const tag = await playerTags(rows.map((r) => r.playerId));
      return paged(
        rows.map((r, i) => ({
          position: p.offset + i + 1,
          id: Number(r.playerId),
          name: r.name,
          ...tag(r.playerId),
          rank: null,
          kills: Number(r.a),
          deaths: Number(r.b),
          headshots: Number(r.c),
          kpd: kpd(r.a, r.b),
          hpk: share(r.c, r.a),
          ggWins: null,
        })),
        total,
        p,
        path,
        { days },
      );
    }
    const { sort, asc } = sortArg(q, MAP_SORTS, "kills", ["name", "position"], { headshots: "hs", rank: "position" });
    // position ascending is the best place first, i.e. the most points (as mapSort).
    const desc = sort === "position" ? asc : !asc;
    const [rows, counts] = await Promise.all([getMapPlayerTable(game.code, m.id, sort, desc, p.limit, p.offset), countMapKillers(game.code, m.id)]);
    const ids = rows.map((r) => r.playerId);
    const [tag, gg] = await Promise.all([playerTags(ids), getMapGgWins(game.code, m.id, ids)]);
    return paged(
      rows.map((r, i) => ({
        position: p.offset + i + 1,
        id: r.playerId,
        name: r.name,
        ...tag(r.playerId),
        rank: r.rank ?? null,
        kills: r.kills,
        deaths: r.deaths,
        headshots: r.headshots,
        kpd: kpd(r.kills, r.deaths),
        hpk: share(r.headshots, r.kills),
        // null outside GunGame rankings (the website leaves the column out).
        ggWins: gg ? (gg.get(r.playerId) ?? 0) : null,
      })),
      counts.players,
      p,
      path,
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
