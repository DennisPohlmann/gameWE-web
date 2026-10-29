import { api, apiCountry, apiPath, visibleGame } from "@/lib/api";
import { kpd, pageOf, pagingArg, paged, share } from "@/lib/api-params";
import { getHallOfFame, hallOfFameShown, type HallEntry } from "@/lib/hall-of-fame";

// The hall of fame of a ranking: per reset period (newest first) the first
// three players with their values at the end of the period, as on the
// website (removed entries and players hidden now are left out, the ones
// below move up). 404 while the ranking shows no hall of fame.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const game = await visibleGame((await params).game);
    if (!game || !(await hallOfFameShown(game.code))) return null;
    const pg = pagingArg(new URL(req.url).searchParams);
    const rows = await getHallOfFame(game.code);
    return paged(
      pageOf(rows, pg).map((r) => ({
        unit: r.unit,
        every: r.every,
        start: r.start,
        end: r.end,
        resetAt: r.resetAt,
        players: r.players,
        places: r.places.map((e) => (e ? hallEntry(e) : null)),
      })),
      rows.length,
      pg,
      apiPath(`/rankings/${game.code}/hall-of-fame`),
    );
  });
}

function hallEntry(e: HallEntry) {
  return {
    place: e.place,
    // null for a player deleted since (no profile any more).
    id: e.currentName === null ? null : e.playerId,
    name: e.name,
    currentName: e.currentName,
    country: apiCountry(e.flag, e.country),
    points: e.skill,
    kills: e.kills,
    deaths: e.deaths,
    kpd: kpd(e.kills, e.deaths),
    headshots: e.headshots,
    hpk: share(e.headshots, e.kills),
    accuracy: share(e.hits, e.shots),
    killStreak: e.killStreak,
    connectionTime: e.connectionTime,
    favoriteWeapon: e.favWeapon ? { code: e.favWeapon, name: e.favWeaponName ?? e.favWeapon } : null,
    rankName: e.rankName || null,
  };
}
