import type { Metadata } from "next";
import Link from "next/link";
import { sortHeads } from "@/components/sort-head";
import { BanBadges, banKindLabel, banWhen, NameBanMark, sourcebansSearchUrl } from "@/components/ban-badges";
import { Empty, Pager, PctBar, PlayerLink, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { getRankingBans, type BanRow } from "@/lib/bans";
import { gameHasShots } from "@/lib/data";
import { fmtDate, fmtNum, kpd, localeOf, ratio, steamIds } from "@/lib/format";
import { getDict, type Lang } from "@/lib/i18n";
import { sortRows, sortState } from "@/lib/table-sort";

// Rows per page unless the visitor picks another number.
const PER_PAGE = 50;

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.bans };
}

// Sort keys of the columns; by default newest first.
const banValues = {
  order: () => 0,
  name: (r: BanRow) => r.player.name,
  type: (r: BanRow): string => r.bans.map((b) => b.kind).join(","),
  reason: (r: BanRow) => r.reason,
  date: (r: BanRow) => r.at,
  seen: (r: BanRow) => Number(r.player.last_event),
  kpd: (r: BanRow) => kpd(Number(r.player.kills), Number(r.player.deaths)),
  // Without kills or shots the bar shows 0 %, so it sorts as 0 %.
  hpk: (r: BanRow) => ratio(Number(r.player.headshots), Number(r.player.kills)) ?? 0,
  acc: (r: BanRow) => ratio(Number(r.player.hits), Number(r.player.shots)) ?? 0,
};

// Banned players of a ranking, as one list like gameME's, all from the
// database (lib/bans.ts): bans the collector recorded from the server logs
// and the bans its bans-sync job stores for every known Steam account (VAC
// and game bans from Steam, running SourceBans bans). Like the players page
// in two tabs: players still in the ranking (hlstats_Players) and, with
// ?view=inactive, players the collector moved to hlstats_PlayersInactive.
// Every banned player is listed, one page of them at a time.
export default async function BansPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const inactive = strParam(sp.view) === "inactive";
  const base = `/${game}/bans`;
  // The type sorts by its shown names.
  const values = { ...banValues, type: (r: BanRow) => r.bans.map((b) => banKindLabel(b.kind, t)).join(", ") };
  const order = sortState(sp, values, "order");
  // Counter-Strike 2 logs no shots: no accuracy column.
  const [shots, { rows, sourcebans, sourcebansUrl, stored, always }] = await Promise.all([gameHasShots(game), getRankingBans(game, t, inactive)]);
  const sb = sourcebans ? { state: sourcebans } : null;
  const sorted = sortRows(rows, values, order.sort, order.asc);
  // Only one page of rows is drawn; sorting covers all of them.
  const limit = rowsParam(sp.rows, PER_PAGE);
  const pages = Math.max(1, Math.ceil(sorted.length / limit));
  const page = Math.min(pageParam(sp.page), pages);
  const offset = (page - 1) * limit;
  const keep = { view: inactive ? "inactive" : undefined, ...order.keep, rows: limit !== PER_PAGE ? limit : undefined };
  const th = sortHeads(order, base, { view: keep.view, rows: keep.rows });
  // VAC and SourceBans side by side whenever the site checks them (always).

  return (
    <Section
      title={
        <span className="subtabs">
          <Link prefetch={false} href={base} className={inactive ? undefined : "active"}>
            {t.banList}
          </Link>
          <Link prefetch={false} href={`${base}?view=inactive`} className={inactive ? "active" : undefined}>
            {t.inactivePlayers}
          </Link>
        </span>
      }
      aside={
        sourcebansUrl ? (
          <a href={`${sourcebansUrl}index.php?p=banlist`} target="_blank" rel="noopener noreferrer nofollow">
            {t.sbOpen}
          </a>
        ) : null
      }
    >
      {!stored ? (
        <p className="muted">{t.bansNoTable}</p>
      ) : sb?.state === "loading" ? (
        <p className="muted">{t.sbLoading}</p>
      ) : sb?.state === "error" ? (
        <p className="muted">{t.sbError}</p>
      ) : sb?.state === "unknown" ? (
        <p className="muted">{t.sbUnknown}</p>
      ) : null}
      {inactive ? <p className="lead">{t.inactiveHint}</p> : null}
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                {th(t.name, "name", "")}
                {th(t.banType, "type", "ban-type-col")}
                {th(t.banReason, "reason", "hide-sm")}
                {th(t.banDate, "date", "")}
                {inactive ? th(t.lastSeen, "seen", "num hide-sm") : null}
                {th(t.kpd, "kpd", "num hide-sm")}
                {th(t.hpk, "hpk", "barcell")}
                {shots ? th(t.acc, "acc", "barcell hide-sm") : null}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(offset, offset + limit).map((r, i) => (
                <tr key={r.player.playerId}>
                  <td className="rank">{fmtNum(offset + i + 1, lang)}</td>
                  <td>
                    <PlayerLink game={game} id={r.player.playerId} name={r.player.name} flag={r.player.flag ? { flag: r.player.flag, country: r.player.country ?? "" } : null} />
                    <NameBanMark bans={r.bans} t={t} lang={lang} />
                  </td>
                  <td className="ban-type-col">
                    <BanBadges bans={r.bans} always={always} links={{ sourcebans: sourcebansSearchUrl(sourcebansUrl, steamIds(r.player.uniqueId)?.steam2) }} t={t} lang={lang} />
                  </td>
                  <td className="hide-sm">{r.reason}</td>
                  <td>{rowWhen(r, lang)}</td>
                  {inactive ? <td className="num hide-sm">{fmtDate(Number(r.player.last_event), lang)}</td> : null}
                  <td className="num hide-sm">{fmtNum(kpd(Number(r.player.kills), Number(r.player.deaths)), lang, 2)}</td>
                  <td className="barcell">
                    <PctBar value={ratio(Number(r.player.headshots), Number(r.player.kills))} lang={lang} />
                  </td>
                  {shots ? (
                    <td className="barcell hide-sm">
                      <PctBar value={ratio(Number(r.player.hits), Number(r.player.shots))} lang={lang} />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : null}
      {rows.length ? (
        <Pager base={base} params={keep} page={page} pages={pages} total={sorted.length} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
      ) : (
        <Empty>{t.bansNone}</Empty>
      )}
      <p className="muted">{t.bansHint}</p>
    </Section>
  );
}

// The row's date: that of its newest ban (to the day for a VAC ban), else
// the text a source gave.
function rowWhen(r: BanRow, lang: Lang): string {
  const newest = r.at ? r.bans.find((b) => b.at === r.at) : undefined;
  return (newest ? banWhen(newest, lang) : r.dateText) || "–";
}
