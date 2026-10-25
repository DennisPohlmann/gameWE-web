import type { Metadata } from "next";
import { PlayerTrend } from "@/components/player-trend";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, Pager, ROW_OPTIONS, TableWrap, pageParam, rowsParam } from "@/components/ui";
import { getPlayerHistory, getPlayerSkillBefore } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, ratio, localeOf } from "@/lib/format";
import { getPlayerSessions, sessionValues } from "@/lib/history";
import { sortHeads } from "@/components/sort-head";
import { sortState } from "@/lib/table-sort";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histSessions}` };
}

// One row per day the player played (hlstats_Players_History).
export default async function SessionsPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const p = await loadHistoryPlayer(game, id, "sessions");
  const { lang, t } = await getDict();
  const { pageSize } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const order = sortState(sp, sessionValues, "date");
  const base = `/${game}/players/${p.playerId}/sessions`;
  const keep = { ...order.keep, rows: limit !== pageSize ? limit : undefined };
  const th = sortHeads(order, base, keep);
  const [{ rows, total }, trend, before] = await Promise.all([
    getPlayerSessions(p.playerId, limit, (page - 1) * limit, order.sort, order.asc),
    getPlayerHistory(p.playerId, 60),
    getPlayerSkillBefore(p.playerId, 60),
  ]);
  const n = (v: number) => fmtNum(v, lang);
  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="sessions">
      <table className="stats">
        <thead>
          <tr>
            <th>{t.statsSummary}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="center">
              <PlayerTrend history={trend} before={before} locale={lang} t={t} />
            </td>
          </tr>
        </tbody>
      </table>
      {rows.length ? (
        <>
          <TableWrap>
            <table className="spaced">
              <thead>
                <tr>
                  {th(t.date, "date", "")}
                  {th(t.change, "change")}
                  {th(t.points, "points")}
                  {th(t.time, "time")}
                  {th(t.rounds, "rounds", "num hide-sm")}
                  {th(t.wins, "wins", "num hide-sm")}
                  {th(t.kills, "kills")}
                  {th(t.deaths, "deaths")}
                  {th(t.kpd, "kpd")}
                  {th(t.killStreak, "streak", "num hide-sm")}
                  {th(t.hs, "hs", "num hide-sm")}
                  {th(t.hpk, "hpk", "num hide-sm")}
                  {th(t.acc, "acc", "num hide-sm")}
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.eventTime}>
                    <td className="nowrap">{String(h.eventTime).slice(0, 10)}</td>
                    <td className={`num ${h.points_change >= 0 ? "good" : "bad"}`}>
                      {h.points_change > 0 ? "+" : ""}
                      {n(h.points_change)}
                    </td>
                    <td className="num">{n(h.skill)}</td>
                    <td className="num">{fmtDuration(h.connection_time)}</td>
                    <td className="num hide-sm">{n(h.rounds)}</td>
                    <td className="num hide-sm">{h.wins ? n(h.wins) : "-"}</td>
                    <td className="num">{n(h.kills)}</td>
                    <td className="num">{n(h.deaths)}</td>
                    <td className="num">{fmtNum(h.kills / Math.max(1, h.deaths), lang, 2)}</td>
                    <td className="num hide-sm">{n(h.kill_streak)}</td>
                    <td className="num hide-sm">{n(h.headshots)}</td>
                    <td className="num hide-sm">{fmtPct(ratio(h.headshots, h.kills), lang)}</td>
                    <td className="num hide-sm">{h.shots ? fmtPct(ratio(h.hits, h.shots), lang) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager base={base} params={keep} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </HistoryFrame>
  );
}
