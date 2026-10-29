import { api, apiPath, apiWeaponUse, publicPlayer } from "@/lib/api";
import { kpd, pageOf, pagingArg, paged, pathId, sortArg, sortRows } from "@/lib/api-params";
import { getPlayerWeapons, type PlayerWeapon } from "@/lib/data";

const SORTS = ["kills", "deaths", "kpd", "headshots", "hpk", "accuracy", "shots", "hits", "damage", "name"] as const;
const key: Record<(typeof SORTS)[number], (w: PlayerWeapon) => number | string> = {
  kills: (w) => Number(w.kills),
  deaths: (w) => Number(w.deaths),
  kpd: (w) => kpd(w.kills, w.deaths),
  shots: (w) => Number(w.shots),
  hits: (w) => Number(w.hits),
  headshots: (w) => Number(w.headshots),
  hpk: (w) => Number(w.headshots) / Math.max(1, Number(w.kills)),
  accuracy: (w) => Number(w.hits) / Math.max(1, Number(w.shots)),
  damage: (w) => Number(w.damage),
  name: (w) => w.name,
};

// A player's weapons with the columns of the profile's weapons table (kills,
// K/D, accuracy, damage per hit, shots per kill) and hits per body zone.
export function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const q = new URL(req.url).searchParams;
    const pg = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "kills", ["name"]);
    const all = sortRows(await getPlayerWeapons(p.playerId), key[sort], asc, (w) => Number(w.weaponId));
    return paged(
      pageOf(all, pg).map(apiWeaponUse),
      all.length,
      pg,
      apiPath(`/players/${p.playerId}/weapons`),
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
