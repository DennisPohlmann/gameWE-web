import { api, apiPath, apiWeaponUse } from "@/lib/api";
import { clanMembers, publicClan } from "@/lib/api-clan";
import { kpd, pageOf, pagingArg, paged, sortArg, sortRows } from "@/lib/api-params";
import { getMembersWeapons, type PlayerWeapon } from "@/lib/data";

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

// The members' weapons added up (the clan page's weapon tables and
// hitboxes), as /players/{id}/weapons.
export function GET(req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    const found = await publicClan(game, id);
    if (!found) return null;
    const q = new URL(req.url).searchParams;
    const pg = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "kills", ["name"]);
    const { ids } = await clanMembers(found.clan.clanId);
    const all = sortRows(await getMembersWeapons(ids), key[sort], asc, (w) => Number(w.weaponId));
    return paged(pageOf(all, pg).map(apiWeaponUse), all.length, pg, apiPath(`/rankings/${found.game.code}/clans/${found.clan.clanId}/weapons`), {
      sort: sort === "kills" ? undefined : sort,
      order: q.get("order") ?? undefined,
    });
  });
}
