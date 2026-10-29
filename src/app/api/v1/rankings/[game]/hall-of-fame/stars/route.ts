import { api, apiCountry, apiPath, visibleGame } from "@/lib/api";
import { pageOf, pagingArg, paged } from "@/lib/api-params";
import { getHallOfFame, hallOfFameShown, starTable } from "@/lib/hall-of-fame";

// The star table of the hall of fame: gold for place 1, silver for 2,
// bronze for 3; most gold first, then silver, bronze, the latest period.
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const game = await visibleGame((await params).game);
    if (!game || !(await hallOfFameShown(game.code))) return null;
    const pg = pagingArg(new URL(req.url).searchParams);
    const stars = starTable(await getHallOfFame(game.code));
    return paged(
      pageOf(stars, pg).map((s, i) => ({
        position: pg.offset + i + 1,
        id: s.playerId,
        name: s.name,
        country: apiCountry(s.flag, s.country),
        gold: s.gold,
        silver: s.silver,
        bronze: s.bronze,
        lastPeriod: s.last,
      })),
      stars.length,
      pg,
      apiPath(`/rankings/${game.code}/hall-of-fame/stars`),
    );
  });
}
