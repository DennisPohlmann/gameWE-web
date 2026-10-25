import type { Metadata } from "next";
import { Suspense } from "react";
import { BarChart, LineChart } from "@/components/chart";
import { LiveTable, ServerTable, serverValues } from "@/components/live";
import { Rich } from "@/components/rich";
import { Section, Skeleton } from "@/components/ui";
import { ServerLoadChart } from "@/components/graphics";
import { everyDay, getDailyActivity, getHourlyActivity, getLivePlayers, getLiveMapPlayers, getMapServers, getServerLoads, getServers, getTotals } from "@/lib/data";
import { dateFormat, fmtNum, fmtPct, localeOf, nowUnix, ratio } from "@/lib/format";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";
import { AwardBoard, awardBoardKeep } from "@/components/award-board";
import { GameEvents } from "@/components/game-events";
import { PlayerMap } from "@/components/player-map";
import { mapMarkers, serverMarkers } from "@/lib/map-markers";
import { getSettings } from "@/lib/settings";
import type { Totals } from "@/lib/data";
import { rankingTitle } from "@/lib/ranking-title";
import { sortRows, sortState } from "@/lib/table-sort";

const BUCKET = 900;

// The ranking's title template does not apply to the page of its own
// segment, so the page fills it in itself: "<Ranking> Servers | <site>".
export async function generateMetadata({ params }: { params: Promise<{ game: string }> }): Promise<Metadata> {
  const [title, { t }] = await Promise.all([rankingTitle((await params).game), getDict()]);
  return title ? { title: { absolute: title.template.replace("%s", t.servers) } } : {};
}

// Start page of a ranking, laid out like gameME's: participating servers with
// a map of who is online and the players on each, the daily awards, then the
// last 14 days. The server section is sent as soon as its rows are read;
// the map, the awards, the events and the graphs follow each on its own
// (Suspense), so the page shows before the slower queries are done.
export default async function ServersPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const { mapLive, mapStyle, gameEvents } = await getSettings();
  const since = nowUnix() - 86400;
  const [servers, totals, live, loadByServer] = await Promise.all([getServers(game), getTotals(game), getLivePlayers(game), getServerLoads(game, since)]);
  const loads = servers.map((s) => loadByServer.get(s.serverId) ?? []);
  // With several servers, the list of all of them and one graph of all of
  // them come first; a single server is shown only once.
  const multi = servers.length > 1;
  // The list of all servers sorts by its column heads; the sections of the
  // single servers below keep the configured order.
  const order = sortState(sp, { ...serverValues, order: () => 0 }, "order");
  const listed = order.sort === "order" ? servers : sortRows(servers, serverValues, order.sort, order.asc);
  const boardKeep = awardBoardKeep(sp);
  const combined = multi ? combinedLoad(servers, loads, since, lang, t.total) : null;
  // Who is online right now, between the server list and the graphs.
  // Shown also when nobody is online (empty map), so the layout stays the same.
  const liveMap = mapLive ? (
    <Suspense
      fallback={
        <div className="box">
          <h4 className="map-title">{t.playerMapLive}</h4>
          <Skeleton className="player-map" />
          <p className="muted">&nbsp;</p>
        </div>
      }
    >
      <LiveMapBox game={game} style={mapStyle} t={t} lang={lang} />
    </Suspense>
  ) : null;
  const head = (
    <Rich
      text={fill(t.tracking, {
        players: fmtNum(totals.players, lang),
        new: fmtNum(totals.newPlayers, lang),
        kills: fmtNum(totals.kills, lang),
        hs: fmtNum(totals.headshots, lang),
        hsPct: fmtPct(ratio(totals.headshots, totals.kills), lang),
        servers: fmtNum(totals.servers, lang),
      })}
    />
  );

  return (
    <>
      <Section title={t.participatingServers}>
        {multi ? (
          <>
            <ServerTable
              game={game}
              servers={listed}
              details
              sort={{ current: order.sort, asc: order.asc, base: `/${game}`, params: { ...order.keep, ...boardKeep } }}
              t={t}
              lang={lang}
              head={head}
            />
            {liveMap}
            {combined ? (
              <div className="box">
                <LineChart locale={lang} ariaLabel={t.players} height={220} labels={combined.labels} dates={combined.dates} series={combined.series} />
              </div>
            ) : null}
          </>
        ) : null}
        {servers.map((s, i) => {
          const players = live.filter((p) => p.server_id === s.serverId);
          if (multi && !players.length && loads[i].length < 2) return null;
          return (
            <div key={s.serverId} className="server-margin">
              <ServerTable game={game} servers={[s]} t={t} lang={lang} head={multi ? undefined : head} details />
              {multi ? null : liveMap}
              {loads[i].length > 1 ? (
                <div className="box">
                  <ServerLoadChart points={loads[i]} slots={s.max_players} locale={lang} labels={{ players: t.players, uptime: t.uptime }} />
                </div>
              ) : null}
              {players.length ? <LiveTable game={game} players={players} t={t} lang={lang} /> : <p>{t.nobodyOnline}</p>}
            </div>
          );
        })}
      </Section>


      <Suspense
        fallback={
          <Section title={t.dailyAwards}>
            <Skeleton rows={8} />
          </Section>
        }
      >
        <AwardBoard game={game} t={t} lang={lang} sort={{ sp, base: `/${game}`, params: order.keep }} />
      </Suspense>

      {gameEvents !== "off" ? (
        <Suspense
          fallback={
            <Section title={t.recentEvents}>
              <Skeleton rows={10} />
            </Section>
          }
        >
          <GameEvents game={game} t={t} lang={lang} />
        </Suspense>
      ) : null}

      <Suspense
        fallback={
          <Section title={t.trend14d}>
            <Skeleton chart />
            <Skeleton chart />
          </Section>
        }
      >
        <Trend game={game} totals={totals} t={t} lang={lang} />
      </Suspense>
    </>
  );
}

// The map of who is online right now and the ranking's servers.
async function LiveMapBox({ game, style, t, lang }: { game: string; style: string; t: Dict; lang: Lang }) {
  const [mapPlayers, mapServers] = await Promise.all([getLiveMapPlayers(game), getMapServers(game)]);
  const markers = mapMarkers(mapPlayers, game, t, lang);
  const serverPins = serverMarkers(mapServers, game, t);
  return (
    <div className="box">
      <h4 className="map-title">{t.playerMapLive}</h4>
      <PlayerMap markers={markers} servers={serverPins} style={style} />
      <p className="muted">
        {markers.length ? fill(t.playerMapLiveHint, { n: String(markers.length) }) : t.playerMapLiveEmpty}
        {serverPins.length ? ` ${t.playerMapServers}` : null}
      </p>
    </div>
  );
}

// The last 14 days: kills per day and the running totals per quarter hour
// (the frags of two weeks; the hourly values are kept for five minutes).
async function Trend({ game, totals, t, lang }: { game: string; totals: Totals; t: Dict; lang: Lang }) {
  const [activityRows, hourly] = await Promise.all([getDailyActivity(game, 14), getHourlyActivity(game, 14)]);
  const activity = everyDay(activityRows, 14);
  const dayLabel = (d: string) => d.slice(8, 10) + "." + d.slice(5, 7) + ".";
  const tipFmt = dateFormat(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const dateFmt = dateFormat(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit" });
  // Graph per 15 minutes: a label at each local midnight.
  // Hover text of each point, e.g. "Mo., 20.10., 14:00".
  const hourTips = hourly.kills.map((_, i) =>
    tipFmt.format((hourly.start + i * hourly.step) * 1000),
  );
  // Hour of each point ("14:00") and its day ("Do., 23.10."): the chart shows
  // a line and the date at midnight and the times as far as they fit.
  const hourLabels = hourly.kills.map((_, i) => {
    const d = new Date((hourly.start + i * hourly.step) * 1000);
    return d.getMinutes() === 0 ? `${String(d.getHours()).padStart(2, "0")}:00` : "";
  });
  const hourDates = hourly.kills.map((_, i) =>
    dateFmt.format((hourly.start + i * hourly.step) * 1000),
  );
  // Kills and headshots per day of the last 14 days, summed from the
  // 15-minute values by the same local days as the date axis; quiet days
  // stay in as 0.
  const daily: { day: string; kills: number; headshots: number }[] = [];
  hourDates.forEach((day, i) => {
    if (daily.at(-1)?.day !== day) daily.push({ day, kills: 0, headshots: 0 });
    daily.at(-1)!.kills += hourly.kills[i];
    daily.at(-1)!.headshots += hourly.headshots[i];
  });
  const days = daily.slice(-14);
  // The running totals start where players, kills or headshots were first
  // recorded; both charts share one left edge, so they stay aligned.
  const killsTotal = running(hourly.kills, Number(totals.kills));
  const headshotsTotal = running(hourly.headshots, Number(totals.headshots));
  const trendTrim = [hourly.players, hourly.kills, hourly.headshots];
  const trendMax = Math.max(0, ...killsTotal, ...headshotsTotal, ...days.map((d) => d.kills));
  return (
    <Section title={t.trend14d}>
      {hourly.players.some((v) => v !== null) || hourly.kills.some((v) => v > 0) ? (
        <>
          {/* Per day, then the running totals per 15 minutes, each with a
              title and its legend; the labels mark midnight of each day. */}
          <BarChart
            locale={lang}
            ariaLabel={t.trendKillsTitle}
            title={t.trendKillsTitle}
            alignTo={trendMax}
            labels={days.map((d) => d.day)}
            series={[
              { label: t.kills, values: days.map((d) => d.kills), className: "s2" },
              { label: t.headshotsLabel, values: days.map((d) => d.headshots), className: "s3" },
            ]}
          />
          {/* Running totals: today's totals minus what came after each point. */}
          <LineChart
            locale={lang}
            ariaLabel={t.trendTotals}
            title={t.trendTotals}
            labels={hourLabels}
            dates={hourDates}
            tips={hourTips}
            hourly
            trimBy={trendTrim}
            alignTo={trendMax}
            series={[
              { label: t.kills, values: killsTotal, className: "s2" },
              { label: t.headshotsLabel, values: headshotsTotal, className: "s3" },
            ]}
          />
        </>
      ) : (
        <>
          <LineChart
            locale={lang}
            ariaLabel={t.players}
            labels={activity.map((a) => dayLabel(a.day))}
            series={[{ label: t.players, values: activity.map((a) => (a.point ? Number(a.point.players) : null)), className: "s1" }]}
          />
          <LineChart
            locale={lang}
            ariaLabel={t.kills}
            labels={activity.map((a) => dayLabel(a.day))}
            series={[
              { label: t.kills, values: activity.map((a) => (a.point ? Number(a.point.kills) : null)), className: "s2" },
              { label: t.headshotsLabel, values: activity.map((a) => (a.point ? Number(a.point.headshots ?? 0) : null)), className: "s3" },
            ]}
          />
        </>
      )}
    </Section>
  );
}

// Players per server and in total over the last 24 hours, averaged per quarter
// hour; quarters without samples stay empty.
function combinedLoad(servers: { name: string }[], loads: { timestamp: number; act_players: number }[][], since: number, lang: string, total: string) {
  const start = Math.floor(since / BUCKET) * BUCKET;
  const n = Math.ceil((nowUnix() - start) / BUCKET);
  const perServer = loads.map((pts) => {
    const sum = new Array<number>(n).fill(0);
    const cnt = new Array<number>(n).fill(0);
    for (const p of pts) {
      const i = Math.floor((p.timestamp - start) / BUCKET);
      if (i >= 0 && i < n) {
        sum[i] += p.act_players;
        cnt[i]++;
      }
    }
    return sum.map((v, i) => (cnt[i] ? Math.round((v / cnt[i]) * 10) / 10 : null));
  });
  if (!perServer.some((v) => v.some((x) => x !== null))) return null;
  const sums = Array.from({ length: n }, (_, i) => {
    const vals = perServer.map((v) => v[i]).filter((x): x is number => x !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) * 10) / 10 : null;
  });
  const timeFmt = dateFormat(lang, { hour: "2-digit", minute: "2-digit" });
  const dayFmt = dateFormat(lang, { weekday: "short", day: "2-digit", month: "2-digit" });
  const labels = Array.from({ length: n }, (_, i) => timeFmt.format((start + i * BUCKET) * 1000));
  const dates = Array.from({ length: n }, (_, i) => dayFmt.format((start + i * BUCKET) * 1000));
  return {
    labels,
    dates,
    series: [
      { label: total, values: sums, className: "s1" },
      ...servers.map((s, i) => ({ label: s.name, values: perServer[i], className: `srv srv${i % 8}` })),
    ],
  };
}

// Running total per point, ending at `total` with the last point.
function running(perPoint: number[], total: number): number[] {
  const out = new Array<number>(perPoint.length);
  let acc = Math.max(total, perPoint.reduce((a, b) => a + b, 0));
  for (let i = perPoint.length - 1; i >= 0; i--) {
    out[i] = acc;
    acc -= perPoint[i];
  }
  return out;
}
