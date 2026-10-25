import Link from "next/link";
import { Suspense } from "react";
import { MiniAvatar } from "@/components/mini-avatar";
import { sortHeads } from "@/components/sort-head";
import { Flag, GameTag, Skeleton } from "@/components/ui";
import { basePath } from "@/lib/base-path";
import { LineChart } from "@/components/chart";
import { PlayerCount } from "@/components/player-count";
import { Rich } from "@/components/rich";
import { VoiceBox } from "@/components/voice-box";
import { everyDay, getClanFlags, getDailyActivityAll, getHourlyActivity, getRankingOverview, getSiteTotals, unlinkedBots, type RankingOverview } from "@/lib/data";
import { dateFormat, fmtNum, localeOf } from "@/lib/format";
import { sumCounts } from "@/lib/player-count";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";
import { sortRows, sortState } from "@/lib/table-sort";
import { gameKind } from "@/lib/games";

// Sort keys of the rankings list; by default the order of the rankings
// (hlstats_Games), which is not a column of its own.
const rankingListValues = {
  order: () => 0,
  name: (r: RankingOverview) => r.name,
  game: (r: RankingOverview) => gameKind(r.realgame ?? "")?.name ?? r.realgame,
  players: (r: RankingOverview) => Number(r.actPlayers),
  top: (r: RankingOverview) => r.topPlayerName,
  clan: (r: RankingOverview) => r.topClanTag,
};

// Start page: all rankings; their servers are listed on each ranking's page.
// The list is sent first; the load graph of the last 30 days (the slowest
// query of the site) streams in below it (Suspense).
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang, t } = await getDict();
  let data;
  try {
    data = await Promise.all([getRankingOverview(), getSiteTotals()]);
  } catch (err) {
    console.error("database:", err);
    return (
      <>
        <Suspense fallback={null}>
          <VoiceBox />
        </Suspense>
        <p className="notice error">{t.dbError}</p>
      </>
    );
  }
  const [loaded, totals] = data;
  const order = sortState(await searchParams, rankingListValues, "order");
  const rankings = sortRows(loaded, rankingListValues, order.sort, order.asc);
  const th = sortHeads(order, "/", {});
  // The country of each ranking's top clan.
  const [clanFlags, bots] = await Promise.all([
    getClanFlags(rankings.map((r) => r.topClanId ?? 0)).catch(() => new Map<number, { flag: string; country: string }>()),
    unlinkedBots(rankings.map((r) => r.topPlayerId ?? 0)).catch(() => new Set<number>()),
  ]);
  const online = sumCounts(rankings.map((r) => r.online));
  return (
    <>
      {/* Asks the TeamSpeak server (up to 4 s when it is down): not before the page. */}
      <Suspense fallback={null}>
        <VoiceBox />
      </Suspense>
      <section className="block">
        <h3>{fill(t.rankingsCount, { n: fmtNum(online.real, lang) })}</h3>
        <div className="container">
          {rankings.length === 0 ? (
            <p className="notice">{t.noRankings}</p>
          ) : (
            <table className="rankings">
              <thead>
                <tr>
                  {/* Two cells like the rows below (name, links), drawn as one. */}
                  {th(t.ranking, "name", "no-rb")}
                  <th className="no-lb" />
                  {th(t.baseGame, "game", "hide-sm fit")}
                  {th(t.players, "players")}
                  {th(t.topPlayer, "top", "")}
                  {th(t.topClan, "clan", "hide-sm")}
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => (
                  <tr key={r.code} className="ranking-line">
                    <td className="no-rb">
                      <Link className="rnk" href={`/${r.code}`} title={r.name}>
                        {r.name}
                      </Link>
                    </td>
                    <td className="no-lb right">
                      <Link className="icon-link" href={`/${r.code}/players`}>
                        <span className="icon icon-players" aria-hidden="true" />
                        {t.players}
                      </Link>
                      <Link className="icon-link" href={`/${r.code}/clans`}>
                        <span className="icon icon-clans" aria-hidden="true" />
                        {t.clans}
                      </Link>
                    </td>
                    <td className="hide-sm fit">
                      <GameTag realgame={r.realgame} long />
                    </td>
                    <td className="num">
                      <span
                        className={
                          r.maxPlayers > 0 && r.actPlayers >= r.maxPlayers ? "srv-full" : r.actPlayers > 0 ? "srv-nempty" : "srv-empty"
                        }
                      >
                        <PlayerCount count={r.online} lang={lang} botsLabel={t.bots} />
                      </span>
                    </td>
                    <td>
                      {r.topPlayerId ? (
                        <>
                          {/* The Steam picture is fetched by the browser (/avatar), so a
                              slow Steam does not hold the page; a missing one shows the
                              placeholder. */}
                          <MiniAvatar src={`${basePath}/avatar/${r.topPlayerId}`} fallback={`${basePath}/avatar-unknown.svg`} />
                          <Flag code={r.topPlayerFlag} title={r.topPlayerCountry} />{" "}
                          {bots.has(r.topPlayerId) ? (
                            r.topPlayerName || `#${r.topPlayerId}`
                          ) : (
                            <Link href={`/${r.code}/players/${r.topPlayerId}`}>{r.topPlayerName || `#${r.topPlayerId}`}</Link>
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="hide-sm">
                      {r.topClanId ? (
                        <>
                          <Flag code={clanFlags.get(r.topClanId)?.flag} title={clanFlags.get(r.topClanId)?.country} />{" "}
                          <Link href={`/${r.code}/clans/${r.topClanId}`}>{r.topClanTag}</Link>
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="summary">
            <Rich
              text={fill(t.siteSummary, {
                p: fmtNum(totals.players, lang),
                c: fmtNum(totals.clans, lang),
                g: fmtNum(totals.games, lang),
                s: fmtNum(totals.servers, lang),
              })}
            />
            {" · "}
            <Rich text={fill(t.siteKills, { k: fmtNum(totals.kills, lang), d: fmtNum(totals.deaths, lang), h: fmtNum(totals.headshots, lang) })} />
          </p>
        </div>
      </section>
      <Suspense
        fallback={
          <section className="block">
            <h3>{t.load}</h3>
            <div className="container">
              <Skeleton chart />
            </div>
          </section>
        }
      >
        <LoadSection t={t} lang={lang} />
      </Suspense>
    </>
  );
}

// Players online over the last 30 days, per quarter hour where the collector
// records the load, else per day. A database error here leaves the block out.
async function LoadSection({ t, lang }: { t: Dict; lang: Lang }) {
  let data;
  try {
    data = await Promise.all([getDailyActivityAll(30), getHourlyActivity(null, 30)]);
  } catch (err) {
    console.error("database:", err);
    return null;
  }
  const [rows, hourly] = data;
  const perHour = hourly.players.some((v) => v !== null);
  const tipFmt = dateFormat(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dateFmt = dateFormat(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit" });
  // Hourly graph: a label at local midnight every few days.
  // Hover text of each hour, e.g. "Mo., 20.10., 14:00".
  const hourTips = hourly.players.map((_, i) =>
    tipFmt.format((hourly.start + i * hourly.step) * 1000),
  );
  // Hour of each point ("14:00") and its day ("Do., 23.10."): the chart shows
  // a line and the date at midnight and the times as far as they fit.
  const hourLabels = hourly.players.map((_, i) => {
    const d = new Date((hourly.start + i * hourly.step) * 1000);
    return d.getMinutes() === 0 ? `${String(d.getHours()).padStart(2, "0")}:00` : "";
  });
  const hourDates = hourly.players.map((_, i) =>
    dateFmt.format((hourly.start + i * hourly.step) * 1000),
  );
  const activity = everyDay(rows, 30);
  const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  // The chart starts at the first point with data, so while the load has been
  // recorded for less than the 30 days the caption names that first day.
  const firstData = (values: (number | null)[]) => values.findIndex((v) => (v ?? 0) !== 0);
  const hourFirst = firstData(hourly.players);
  const dayFirst = firstData(activity.map((a) => (a.point ? Number(a.point.players) : null)));
  const loadCaption = perHour
    ? hourFirst * hourly.step >= 86400
      ? fill(t.loadCaptionHourlySince, { d: dateFmt.format((hourly.start + hourFirst * hourly.step) * 1000) })
      : t.loadCaptionHourly
    : dayFirst > 0
      ? fill(t.loadCaptionSince, { d: dayLabel(activity[dayFirst].day) })
      : t.loadCaption;
  return (
    <section className="block">
      <h3>{t.load}</h3>
      <div className="container">
        <div className="box">
          {perHour ? (
            <LineChart locale={lang} ariaLabel={loadCaption} labels={hourLabels} dates={hourDates} tips={hourTips} hourly legend series={[{ label: t.playersOnline, values: hourly.players, className: "s1" }]} />
          ) : (
            <LineChart
              locale={lang}
              ariaLabel={loadCaption}
              legend
              labels={activity.map((a) => dayLabel(a.day))}
              series={[{ label: t.players, values: activity.map((a) => (a.point ? Number(a.point.players) : null)), className: "s1" }]}
            />
          )}
          <p className="small center">{loadCaption}</p>
        </div>
      </div>
    </section>
  );
}
