import type { Metadata } from "next";
import { PlayerKillsTrend, PlayerTrend } from "@/components/player-trend";
import { BackToPlayer, HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, Pager, PctBar, ROW_OPTIONS, SortTh, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { getPlayerHistory, getPlayerSkillBefore } from "@/lib/data";
import { fmtNum, kpd, ratio, localeOf } from "@/lib/format";
import { getPlayerSessionDays } from "@/lib/history";
import { getDict } from "@/lib/i18n";
import { SESSION_SORT_DEFAULT, fmtSessionTime, sessionPage, sessionSortParam, sortSessions, type SessionSort } from "@/lib/sessions";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histSessions}` };
}

// gameME's icon after the points change: a small square in the gain or
// loss colour with an arrow up (points won) or down (points lost).
function ChangeArrow({ up, label }: { up: boolean; label: string }) {
  return (
    <svg className="change-arrow" viewBox="0 0 12 12" width="12" height="12" role="img" aria-label={label}>
      <rect width="12" height="12" rx="2" />
      <path d={up ? "M6 2 10 7H7.3v3H4.7V7H2z" : "M6 10 2 5h2.7V2h2.6v3H10z"} />
    </svg>
  );
}

// gameME's sessions page: the player trend and kills/deaths per day in a
// summary box, then one row per day the player played
// (hlstats_Players_History), every column sortable, newest day first.
export default async function SessionsPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const sp = await searchParams;
  const p = await loadHistoryPlayer(game, id, "sessions");
  const { lang, t } = await getDict();
  const { pageSize } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const sort = sessionSortParam(strParam(sp.sort));
  const asc = strParam(sp.dir) === "asc";
  const [days, trend, before] = await Promise.all([
    getPlayerSessionDays(p.playerId),
    getPlayerHistory(p.playerId, 60),
    getPlayerSkillBefore(p.playerId, 60),
  ]);
  const shown = sessionPage(sortSessions(days, sort, asc), pageParam(sp.page), limit);
  const n = (v: number) => fmtNum(Number(v), lang);
  const base = `/${game}/players/${p.playerId}/sessions`;
  const linkParams = {
    sort: sort !== SESSION_SORT_DEFAULT ? sort : undefined,
    dir: asc ? "asc" : undefined,
    rows: limit !== pageSize ? limit : undefined,
  };
  const th = (label: string, k: SessionSort, cls = "num") => (
    <SortTh label={label} sortKey={k} className={cls} current={sort} asc={asc} base={base} params={linkParams} />
  );
  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="sessions" back={false}>
      <BackToPlayer game={game} id={p.playerId} t={t} />
      <table className="stats">
        <thead>
          <tr>
            <th>{t.statsSummary}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="center">
              {trend.length ? (
                <div className="cont-2 session-charts">
                  <div>
                    <PlayerTrend history={trend} before={before} locale={lang} t={t} />
                  </div>
                  <div>
                    <PlayerKillsTrend history={trend} before={before} locale={lang} t={t} />
                  </div>
                </div>
              ) : (
                <span className="muted">{t.noData}</span>
              )}
            </td>
          </tr>
        </tbody>
      </table>
      <BackToPlayer game={game} id={p.playerId} t={t} />
      {days.length ? (
        <>
          <TableWrap>
            <table className="sessions">
              <thead>
                <tr>
                  {th(t.date, "date", "center")}
                  {th(t.change, "change")}
                  {th(t.points, "points")}
                  {th(t.time, "time", "center")}
                  {th(t.rounds, "rounds", "num hide-sm")}
                  {th(t.wins, "wins", "num hide-sm")}
                  {th(t.kills, "kills")}
                  {th(t.deaths, "deaths")}
                  {th(t.kpd, "kpd")}
                  {th(t.killStreak, "streak", "num hide-sm")}
                  {th(t.hs, "hs", "num hide-sm")}
                  {th(t.hpk, "hpk", "barcell hide-sm")}
                  {th(t.acc, "acc", "barcell hide-sm")}
                </tr>
              </thead>
              <tbody>
                {shown.rows.map((h) => (
                  <tr key={h.eventTime}>
                    <td className="center nowrap">{String(h.eventTime).slice(0, 10)}</td>
                    <td className={`num nowrap${h.points_change > 0 ? " good" : h.points_change < 0 ? " bad" : ""}`}>
                      {n(h.points_change)}
                      {h.points_change ? <ChangeArrow up={h.points_change > 0} label={h.points_change > 0 ? t.skillGained : t.skillLost} /> : null}
                    </td>
                    <td className="num">{n(h.skill)}</td>
                    <td className="center nowrap">{fmtSessionTime(h.connection_time)}</td>
                    <td className="num hide-sm">{n(h.rounds)}</td>
                    <td className="num hide-sm">{Number(h.wins) ? n(h.wins) : "-"}</td>
                    <td className="num">{n(h.kills)}</td>
                    <td className="num">{n(h.deaths)}</td>
                    <td className="num">{fmtNum(kpd(Number(h.kills), Number(h.deaths)), lang, 2)}</td>
                    <td className="num hide-sm">{n(h.kill_streak)}</td>
                    <td className="num hide-sm">{n(h.headshots)}</td>
                    <td className="barcell hide-sm">
                      <PctBar value={ratio(Number(h.headshots), Number(h.kills))} lang={lang} />
                    </td>
                    <td className="barcell hide-sm">{Number(h.shots) ? <PctBar value={ratio(Number(h.hits), Number(h.shots))} lang={lang} /> : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager
            base={base}
            params={linkParams}
            page={shown.page}
            pages={shown.pages}
            total={days.length}
            rows={{ value: limit, options: ROW_OPTIONS }}
            locale={localeOf(lang)}
            labels={t}
          />
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </HistoryFrame>
  );
}
