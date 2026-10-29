import { api, apiCountry, apiPath, playerTags } from "@/lib/api";
import { kpd, pageOf, pagingArg, paged } from "@/lib/api-params";
import { searchArgs } from "@/lib/api-search";
import { searchPlayers, unlinkedBots } from "@/lib/data";

// The website's player search over all rankings (or one): every name a
// player used, or a Steam ID in any of its forms (exact). Hidden and banned
// players are not found; at most 100 hits, best points first.
export function GET(req: Request) {
  return api(async () => {
    const q = new URL(req.url).searchParams;
    const { text, by, game } = await searchArgs(q, ["names", "steamid"]);
    const pg = pagingArg(q);
    const hits = await searchPlayers(text, by === "steamid" ? "uniqueid" : "names", game);
    const ids = hits.map((h) => Number(h.playerId));
    const [tags, noLink] = await Promise.all([playerTags(ids), unlinkedBots(ids)]);
    return paged(
      pageOf(hits, pg).map((h, i) => ({
        position: pg.offset + i + 1,
        game: h.game,
        id: Number(h.playerId),
        name: h.name,
        alias: h.alias,
        country: apiCountry(h.flag, h.country),
        bot: tags(Number(h.playerId)).bot,
        points: Number(h.skill),
        kills: Number(h.kills),
        deaths: Number(h.deaths),
        kpd: kpd(h.kills, h.deaths),
        lastEvent: Number(h.last_event),
        // Bots of rankings that do not rank them have no profile.
        url: noLink.has(Number(h.playerId)) ? null : apiPath(`/players/${Number(h.playerId)}`),
      })),
      hits.length,
      pg,
      apiPath("/search/players"),
      { q: text, in: by === "names" ? undefined : by, game },
    );
  });
}
