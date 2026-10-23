import type { Metadata } from "next";
import { TrendChart } from "@/components/graphics";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, Pager, ROW_OPTIONS, TableWrap, pageParam, rowsParam } from "@/components/ui";
import { getPlayerHistory } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, ratio, localeOf } from "@/lib/format";
import { getPlayerSessions } from "@/lib/history";
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
  const [{ rows, total }, trend] = await Promise.all([getPlayerSessions(p.playerId, limit, (page - 1) * limit), getPlayerHistory(p.playerId, 60)]);
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
              {trend.length > 1 ? (
                <TrendChart
                  days={trend.map((h) => ({ day: h.eventTime.slice(0, 10), skill: h.skill, change: h.skill_change }))}
                  locale={lang}
                  labels={{ points: t.points, gained: t.skillGained, lost: t.skillLost }}
                />
              ) : (
                <span className="muted">{t.noData}</span>
              )}
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
                  <th>{t.date}</th>
                  <th className="num">{t.change}</th>
                  <th className="num">{t.points}</th>
                  <th className="num">{t.time}</th>
                  <th className="num hide-sm">{t.rounds}</th>
                  <th className="num hide-sm">{t.wins}</th>
                  <th className="num">{t.kills}</th>
                  <th className="num">{t.deaths}</th>
                  <th className="num">{t.kpd}</th>
                  <th className="num hide-sm">{t.killStreak}</th>
                  <th className="num hide-sm">{t.hs}</th>
                  <th className="num hide-sm">{t.hpk}</th>
                  <th className="num hide-sm">{t.acc}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((h) => (
                  <tr key={h.eventTime}>
                    <td className="nowrap">{String(h.eventTime).slice(0, 10)}</td>
                    <td className={`num ${h.skill_change >= 0 ? "good" : "bad"}`}>
                      {h.skill_change > 0 ? "+" : ""}
                      {n(h.skill_change)}
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
          <Pager base={`/${game}/players/${p.playerId}/sessions`} params={{ rows: limit !== pageSize ? limit : undefined }} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </HistoryFrame>
  );
}
