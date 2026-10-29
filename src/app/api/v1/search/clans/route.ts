import { api, apiPath } from "@/lib/api";
import { pageOf, pagingArg, paged } from "@/lib/api-params";
import { searchArgs } from "@/lib/api-search";
import { searchClans } from "@/lib/data";

// The website's clan search over all rankings (or one): part of the tag or
// the name. Clans without a ranked member are not found; at most 100 hits,
// most members first.
export function GET(req: Request) {
  return api(async () => {
    const q = new URL(req.url).searchParams;
    const { text, game } = await searchArgs(q, ["clans"]);
    const pg = pagingArg(q);
    const hits = await searchClans(text, game);
    return paged(
      pageOf(hits, pg).map((c, i) => ({
        position: pg.offset + i + 1,
        game: c.game,
        id: Number(c.clanId),
        tag: c.tag,
        name: c.name,
        members: Number(c.members),
        avgPoints: c.skill === null ? null : Number(c.skill),
        url: apiPath(`/rankings/${c.game}/clans/${Number(c.clanId)}`),
      })),
      hits.length,
      pg,
      apiPath("/search/clans"),
      { q: text, game },
    );
  });
}
