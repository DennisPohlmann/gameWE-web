import Link from "next/link";
import { MiniAvatar } from "@/components/mini-avatar";
import { Flag, GameTag } from "@/components/ui";
import { basePath } from "@/lib/base-path";
import { LineChart } from "@/components/chart";
import { Rich } from "@/components/rich";
import { everyDay, getClanFlags, getDailyActivityAll, getHourlyActivity, getPlayer, getRankingOverview, getSiteTotals, unlinkedBots } from "@/lib/data";
import { fmtNum, localeOf, steamIds } from "@/lib/format";
import { getSteamProfile } from "@/lib/steam";
import { fill, getDict } from "@/lib/i18n";

// Start page: all rankings; their servers are listed on each ranking's page.
export default async function Home() {
  const { lang, t } = await getDict();
  let data;
  try {
    data = await Promise.all([getRankingOverview(), getSiteTotals(), getDailyActivityAll(30), getHourlyActivity(null, 30)]);
  } catch (err) {
    console.error("database:", err);
    return <p className="notice error">{t.dbError}</p>;
  }
  const [rankings, totals, rows, hourly] = data;
  // Steam picture of each ranking's top player and the country of its top clan.
  const [avatars, clanFlags, bots] = await Promise.all([
    Promise.all(rankings.map((r) => (r.topPlayerId ? smallAvatar(r.topPlayerId) : null))),
    getClanFlags(rankings.map((r) => r.topClanId ?? 0)).catch(() => new Map<number, { flag: string; country: string }>()),
    unlinkedBots(rankings.map((r) => r.topPlayerId ?? 0)).catch(() => new Set<number>()),
  ]);
  const perHour = hourly.players.some((v) => v !== null);
  // Hourly graph: a label at local midnight every few days.
  // Hover text of each hour, e.g. "Mo., 20.10., 14:00".
  const hourTips = hourly.players.map((_, i) =>
    new Date((hourly.start + i * hourly.step) * 1000).toLocaleString(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }),
  );
  // Hour of each point ("14:00") and its day ("Do., 23.10."): the chart shows
  // a line and the date at midnight and the times as far as they fit.
  const hourLabels = hourly.players.map((_, i) => {
    const d = new Date((hourly.start + i * hourly.step) * 1000);
    return d.getMinutes() === 0 ? `${String(d.getHours()).padStart(2, "0")}:00` : "";
  });
  const hourDates = hourly.players.map((_, i) =>
    new Date((hourly.start + i * hourly.step) * 1000).toLocaleDateString(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit" }),
  );
  const activity = everyDay(rows, 30);
  const online = rankings.reduce((n, r) => n + r.actPlayers, 0);
  const dayLabel = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.`;
  return (
    <>
      <section className="block">
        <h3>{fill(t.rankingsCount, { n: fmtNum(online, lang) })}</h3>
        <div className="container">
          {rankings.length === 0 ? (
            <p className="notice">{t.noRankings}</p>
          ) : (
            <table className="rankings">
              <thead>
                <tr>
                  <th colSpan={2}>{t.ranking}</th>
                  <th className="hide-sm">{t.baseGame}</th>
                  <th className="num">{t.players}</th>
                  <th>{t.topPlayer}</th>
                  <th className="hide-sm">{t.topClan}</th>
                </tr>
              </thead>
              <tbody>
                {rankings.map((r, i) => (
                  <tr key={r.code} className="ranking-line">
                    <td className="no-rb">
                      <Link className="rnk" href={`/${r.code}`}>
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
                    <td className="hide-sm">
                      <GameTag realgame={r.realgame} long />
                    </td>
                    <td className="num">
                      <span
                        className={
                          r.maxPlayers > 0 && r.actPlayers >= r.maxPlayers ? "srv-full" : r.actPlayers > 0 ? "srv-nempty" : "srv-empty"
                        }
                      >
                        {r.actPlayers}/{r.maxPlayers}
                      </span>
                    </td>
                    <td>
                      {r.topPlayerId ? (
                        <>
                          <MiniAvatar src={avatars[i]} fallback={`${basePath}/avatar-unknown.svg`} />
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
      <section className="block">
        <h3>{t.load}</h3>
        <div className="container">
          <div className="box">
            {perHour ? (
              <LineChart locale={lang} ariaLabel={t.loadCaptionHourly} labels={hourLabels} dates={hourDates} tips={hourTips} hourly series={[{ label: t.playersOnline, values: hourly.players, className: "s1" }]} />
            ) : (
              <LineChart
                locale={lang}
                ariaLabel={t.loadCaption}
                labels={activity.map((a) => dayLabel(a.day))}
                series={[{ label: t.players, values: activity.map((a) => (a.point ? Number(a.point.players) : null)), className: "s1" }]}
              />
            )}
            <p className="small center">{perHour ? t.loadCaptionHourly : t.loadCaption}</p>
          </div>
        </div>
      </section>
    </>
  );
}

// Small Steam avatar URL of a player; a slow Steam lookup is not waited for.
async function smallAvatar(playerId: number): Promise<string | null> {
  try {
    const ids = steamIds((await getPlayer(playerId))?.uniqueId);
    if (!ids) return null;
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1500));
    const steam = await Promise.race([getSteamProfile(ids.steam64), timeout]);
    return steam?.avatarSmall ?? steam?.avatar ?? null;
  } catch {
    return null;
  }
}
