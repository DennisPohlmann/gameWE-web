import { api, apiPath, publicPlayer } from "@/lib/api";
import { kpd, pageOf, pagingArg, paged, pathId, share, sortArg, sortRows } from "@/lib/api-params";
import { getPlayerWeapons, type PlayerWeapon } from "@/lib/data";
import { ZONES } from "@/lib/zones";

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
      pageOf(all, pg).map((w) => ({
        code: w.code,
        name: w.name,
        kills: Number(w.kills),
        deaths: Number(w.deaths),
        headshots: Number(w.headshots),
        shots: Number(w.shots),
        hits: Number(w.hits),
        damage: Number(w.damage),
        kpd: kpd(w.kills, w.deaths),
        hpk: share(w.headshots, w.kills),
        accuracy: share(w.hits, w.shots),
        damagePerHit: Number(w.hits) ? Math.round((Number(w.damage) / Number(w.hits)) * 100) / 100 : null,
        shotsPerKill: Number(w.kills) ? Math.round((Number(w.shots) / Number(w.kills)) * 100) / 100 : null,
        hitboxes: Object.fromEntries(ZONES.map((z) => [z, Number(w[z])])),
      })),
      all.length,
      pg,
      apiPath(`/players/${p.playerId}/weapons`),
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
