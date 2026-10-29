import { api, apiBan, apiCountry, apiPath, visibleGame } from "@/lib/api";
import { enumArg, kpd, pageOf, pagingArg, paged, share, sortArg, sortRows } from "@/lib/api-params";
import { getRankingBans, type BanRow } from "@/lib/bans";
import { dicts } from "@/translations";

const SORTS = ["date", "name", "type", "reason", "kpd", "hpk", "acc"] as const;
const key: Record<(typeof SORTS)[number], (r: BanRow) => number | string> = {
  date: (r) => r.at ?? 0,
  name: (r) => r.player.name ?? "",
  type: (r) => r.bans.map((b) => b.kind).join(","),
  reason: (r) => r.reason,
  kpd: (r) => kpd(Number(r.player.kills), Number(r.player.deaths)),
  hpk: (r) => Number(r.player.headshots) / Math.max(1, Number(r.player.kills)),
  acc: (r) => Number(r.player.hits) / Math.max(1, Number(r.player.shots)),
};

// The bans page of a ranking: every banned player once, with each running
// ban (recorded by the collector from the logs, SourceBans and VAC/game
// bans from Steam as the collector stores them), newest first, paged as on
// the website. Texts (length) in English.
// view=inactive: the page's "Inactive players" tab (banned players the
// collector moved to hlstats_PlayersInactive).
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const game = await visibleGame((await params).game);
    if (!game) return null;
    const q = new URL(req.url).searchParams;
    const pg = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "date", ["name", "type", "reason"]);
    const view = enumArg(q, "view", ["ranked", "inactive"] as const, "ranked");
    const { rows } = await getRankingBans(game.code, dicts.en, view === "inactive");
    const all = sortRows(rows, key[sort], asc, (r) => Number(r.player.playerId));
    return paged(
      pageOf(all, pg).map((r, i) => ({
        position: pg.offset + i + 1,
        id: Number(r.player.playerId),
        name: r.player.name,
        country: apiCountry(r.player.flag, r.player.country),
        bannedAt: r.at,
        dateText: r.at ? null : r.dateText || null,
        reason: r.reason || null,
        bans: r.bans.map(apiBan),
        kills: Number(r.player.kills),
        deaths: Number(r.player.deaths),
        kpd: kpd(r.player.kills, r.player.deaths),
        hpk: share(r.player.headshots, r.player.kills),
        accuracy: share(r.player.hits, r.player.shots),
        url: apiPath(`/players/${Number(r.player.playerId)}`),
      })),
      all.length,
      pg,
      apiPath(`/rankings/${game.code}/bans`),
      { view: view === "inactive" ? view : undefined, sort: sort === "date" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
