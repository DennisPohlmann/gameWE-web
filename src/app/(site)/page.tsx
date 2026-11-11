import Link from "next/link";
import { Suspense } from "react";
import { MiniAvatar } from "@/components/mini-avatar";
import { externalImage } from "@/lib/consent";
import { getConsent } from "@/lib/consent-server";
import { sortHeads } from "@/components/sort-head";
import { Flag, GameIcon, Skeleton } from "@/components/ui";
import { basePath } from "@/lib/base-path";
import { LineChart } from "@/components/chart";
import { Sparkline } from "@/components/sparkline";
import { countsSinceFirst, sparkTipValue, wholeDays, type SparkBucket } from "@/lib/sparkline";
import { HoverTip } from "@/components/hover-tip";
import { PlayerCount } from "@/components/player-count";
import { VoiceBox } from "@/components/voice-box";
import {
  everyDay,
  getActiveClansPerDay,
  getClanFlags,
  getDailyActivityAll,
  getGeneralStats,
  getHourlyActivity,
  getRankingOverview,
  unlinkedBots,
  type DayPoint,
  type RankingOverview,
} from "@/lib/data";
import { dateFormat, fmtDateTime, fmtNum, fmtPct, localeOf } from "@/lib/format";
import { sumCounts } from "@/lib/player-count";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";
import { sortRows, sortState } from "@/lib/table-sort";
import { gameIconSrc } from "@/lib/game-icons";

// Sort keys of the rankings list; by default the order of the rankings
// (hlstats_Games), which is not a column of its own.
const rankingListValues = {
  order: () => 0,
  name: (r: RankingOverview) => r.name,
  players: (r: RankingOverview) => Number(r.actPlayers),
  top: (r: RankingOverview) => r.topPlayerName,
  clan: (r: RankingOverview) => r.topClanTag,
};

// Start page: all rankings; their servers are listed on each ranking's page.
// The list is sent first; the general statistics and the load graph of the
// last 30 days (the slowest query of the site, shared by both) stream in
// below it (Suspense).
export default async function Home({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { lang, t } = await getDict();
  const consent = await getConsent();
  let data;
  try {
    data = await getRankingOverview();
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
  const loaded = data;
  const order = sortState(await searchParams, rankingListValues, "order");
  const rankings = sortRows(loaded, rankingListValues, order.sort, order.asc);
  const th = sortHeads(order, "/", {});
  // The country of each ranking's top clan.
  const [clanFlags, bots] = await Promise.all([
    getClanFlags(rankings.map((r) => r.topClanId ?? 0)).catch(() => new Map<number, { flag: string; country: string }>()),
    unlinkedBots(rankings.map((r) => r.topPlayerId ?? 0)).catch(() => new Set<number>()),
  ]);
  // Everyone on the servers, bots included (the rows show both apart).
  const online = sumCounts(rankings.map((r) => r.online));
  return (
    <>
      {/* Asks the TeamSpeak server (up to 4 s when it is down): not before the page. */}
      <Suspense fallback={null}>
        <VoiceBox />
      </Suspense>
      <section className="block">
        <h3>{fill(t.rankingsCount, { n: fmtNum(online.real + online.bots, lang) })}</h3>
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
                  {th(t.players, "players")}
                  {th(t.topPlayer, "top", "")}
                  {th(t.topClan, "clan", "hide-sm")}
                </tr>
              </thead>
              <tbody>
                {rankings.map((r) => (
                  <tr key={r.code} className="ranking-line">
                    <td className="no-rb">
                      {/* Only here the game's icon is 24 x 24, the name beside it. */}
                      <span className="rnk-cell">
                        {/* Without a known game an empty square, so the names line up. */}
                        {gameIconSrc(r.realgame) ? <GameIcon realgame={r.realgame} size={24} /> : <span className="game-icon-24" aria-hidden="true" />}
                        <Link prefetch={false} className="rnk" href={`/${r.code}`} title={r.name}>
                          {r.name}
                        </Link>
                      </span>
                    </td>
                    <td className="no-lb right">
                      <Link prefetch={false} className="icon-link" href={`/${r.code}/players`}>
                        <span className="icon icon-players" aria-hidden="true" />
                        {/* On phones only the round icon, the word stays for screen readers. */}
                        <span className="icon-link-text">{t.players}</span>
                      </Link>
                      <Link prefetch={false} className="icon-link" href={`/${r.code}/clans`}>
                        <span className="icon icon-clans" aria-hidden="true" />
                        <span className="icon-link-text">{t.clans}</span>
                      </Link>
                    </td>
                    <td className="num" data-label={t.players}>
                      <span
                        className={
                          r.maxPlayers > 0 && r.actPlayers >= r.maxPlayers ? "srv-full" : r.actPlayers > 0 ? "srv-nempty" : "srv-empty"
                        }
                      >
                        <PlayerCount count={r.online} lang={lang} botsLabel={t.bots} />
                      </span>
                    </td>
                    <td data-label={t.topPlayer}>
                      {r.topPlayerId ? (
                        <>
                          {/* The Steam picture is fetched by the browser (/avatar), so a
                              slow Steam does not hold the page; a missing one, or one
                              without consent to Steam pictures, shows the placeholder. */}
                          <MiniAvatar src={externalImage(consent, `${basePath}/avatar/${r.topPlayerId}`)} fallback={`${basePath}/avatar-unknown.svg`} />
                          <Flag code={r.topPlayerFlag} title={r.topPlayerCountry} />{" "}
                          {bots.has(r.topPlayerId) ? (
                            r.topPlayerName || `#${r.topPlayerId}`
                          ) : (
                            <Link prefetch={false} href={`/${r.code}/players/${r.topPlayerId}`}>{r.topPlayerName || `#${r.topPlayerId}`}</Link>
                          )}
                        </>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="hide-sm rnk-clan" data-label={t.topClan}>
                      {r.topClanId ? (
                        <>
                          <Flag code={clanFlags.get(r.topClanId)?.flag} title={clanFlags.get(r.topClanId)?.country} />{" "}
                          <Link prefetch={false} href={`/${r.code}/clans/${r.topClanId}`}>{r.topClanTag}</Link>
                        </>
                      ) : (
                        <span className="rnk-none">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <Suspense
        fallback={
          <section className="block general-stats">
            <h3>{t.generalStats}</h3>
            <Skeleton rows={2} />
          </section>
        }
      >
        <GeneralStatsSection t={t} lang={lang} />
      </Suspense>
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

// Five cards (players, clans, servers, kills, headshots), each with its count,
// what is going on now and a faint line of the last 30 days behind the text:
// players online and servers with players, bots included like "playing now"
// (server load, else active players per day; "with players now" counts only
// servers with real players), clans
// with an active member per day, kills and headshots per 15 minutes (frags,
// else per day; with their share of the kills below the headshots). Hovering or tapping a
// card's ⓘ shows what its number and its line count (HoverTip), hovering
// or tapping its line the time and value of that point. A database error
// leaves the block out; a missing line only leaves its card without one.
async function GeneralStatsSection({ t, lang }: { t: Dict; lang: Lang }) {
  let stats;
  try {
    stats = await getGeneralStats();
  } catch (err) {
    console.error("database:", err);
    return null;
  }
  const [hourly, daily, clanDays] = await Promise.all([
    getHourlyActivity(null, 30).catch(() => null),
    getDailyActivityAll(30).catch(() => null),
    getActiveClansPerDay(30).catch(() => null),
  ]);
  // A line is its values and where each one lies in time: per quarter hour
  // (hourly.start + i * hourly.step) or per day of the last 30 days.
  type Line = { values: (number | null)[]; at: (i: number) => { start: number; end: number; day: boolean } };
  const days = everyDay([], 30).map((d) => Date.parse(`${d.day}T12:00:00Z`) / 1000);
  const dayAt = (i: number) => ({ start: days[i], end: days[i], day: true });
  const hourAt = (i: number) => ({ start: hourly!.start + i * hourly!.step, end: hourly!.start + (i + 1) * hourly!.step, day: false });
  const none: Line = { values: [], at: dayAt };
  // Whole days only, unless there are fewer than two yet (wholeDays).
  const perDay = <T extends { day: string }>(rows: T[] | null, value: (r: T) => number): Line =>
    rows ? { values: wholeDays(everyDay(rows, 30).map((d) => (d.point ? value(d.point) : null))), at: dayAt } : none;
  // Kills and headshots per 15 minutes from the frags, like players online:
  // the history per day has only one whole day the day after a reset, so the
  // lines would be gone for a day. The days are the fallback.
  const fragLine = (counts: number[] | undefined, day: (r: DayPoint) => number): Line => {
    const line = counts ? countsSinceFirst(counts) : [];
    return line.length ? { values: line, at: hourAt } : perDay(daily, day);
  };
  const playersLine = hourly?.players.some((v) => v !== null) ? { values: hourly.players, at: hourAt } : perDay(daily, (r) => Number(r.players));
  // Hover text of a point of a line: its day or time span, then the value.
  // Players and servers online are averaged over a span of several quarter
  // hours ("Ø"), kills and headshots added up.
  const dayFmt = dateFormat(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit" });
  const timeFmt = dateFormat(localeOf(lang), { hour: "2-digit", minute: "2-digit" });
  const spanOf = (line: Line, b: SparkBucket) => {
    const a = line.at(b.from);
    const z = line.at(b.to);
    if (a.day) return b.from === b.to ? dayFmt.format(a.start * 1000) : `${dayFmt.format(a.start * 1000)} – ${dayFmt.format(z.start * 1000)}`;
    const from = `${dayFmt.format(a.start * 1000)}, ${timeFmt.format(a.start * 1000)}`;
    const sameDay = dayFmt.format(a.start * 1000) === dayFmt.format((z.end - 1) * 1000);
    return `${from} – ${sameDay ? "" : `${dayFmt.format(z.end * 1000)}, `}${timeFmt.format(z.end * 1000)}`;
  };
  const lineTip = (label: string, line: Line, sum: boolean) => (b: SparkBucket) =>
    `${spanOf(line, b)}\n${label}: ${sum || b.n === 1 ? "" : "Ø "}${fmtNum(sparkTipValue(b, sum), lang)}`;
  const clansLine = perDay(clanDays, (r) => Number(r.n));
  const serversLine: Line = hourly ? { values: hourly.servers, at: hourAt } : none;
  const killsLine = fragLine(hourly?.kills, (r) => Number(r.kills));
  const headshotsLine = fragLine(hourly?.headshots, (r) => Number(r.headshots ?? 0));
  const cards = [
    { label: t.players, value: stats.players, sub: fill(t.gsPlayersNow, { n: fmtNum(stats.onlineWithBots, lang) }), line: playersLine.values, lineTip: lineTip(t.playersOnline, playersLine, false), tip: t.gsTipPlayers },
    { label: t.clans, value: stats.clans, sub: fill(t.gsClansIn, { n: fmtNum(stats.clanRankings, lang) }), line: clansLine.values, lineTip: lineTip(t.clans, clansLine, false), tip: t.gsTipClans },
    { label: t.servers, value: stats.servers, sub: fill(t.gsServersActive, { n: fmtNum(stats.serversActive, lang) }), line: serversLine.values, lineTip: lineTip(t.servers, serversLine, false), tip: t.gsTipServers },
    {
      label: t.kills,
      value: stats.kills,
      sub: stats.lastKill ? fill(t.gsLastKill, { d: fmtDateTime(stats.lastKill, lang) }) : t.gsNoKill,
      line: killsLine.values,
      lineTip: lineTip(t.kills, killsLine, true),
      tip: t.gsTipKills,
    },
    {
      label: t.headshotsLabel,
      value: stats.headshots,
      sub: fill(t.gsHeadshotShare, { p: fmtPct(stats.kills > 0 ? stats.headshots / stats.kills : null, lang) }),
      line: headshotsLine.values,
      lineTip: lineTip(t.headshotsLabel, headshotsLine, true),
      tip: t.gsTipHeadshots,
    },
  ];
  return (
    <section className="block general-stats">
      <h3>{t.generalStats}</h3>
      <HoverTip className="gs-tips">
        <ul className="gs-cards">
          {cards.map((c) => (
            <li key={c.label} className="gs-card">
              <Sparkline values={c.line} tip={c.lineTip} />
              {/* What the number and the line count: on hover or tap of the ⓘ. */}
              <span className="gs-info" role="img" aria-label={`${c.label}: ${c.tip}`} data-tip={`${c.label}\n${c.tip}`}>
                i
              </span>
              <span className="gs-label">{c.label}</span>
              <span className="gs-value">{fmtNum(c.value, lang)}</span>
              <span className="gs-sub">{c.sub}</span>
            </li>
          ))}
        </ul>
      </HoverTip>
    </section>
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
