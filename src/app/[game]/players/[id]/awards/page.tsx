import type { Metadata } from "next";
import { Ribbon, RibbonLevel, ribbonClassName } from "@/components/badges";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, Pager, ROW_OPTIONS, TableWrap, pageParam, rowsParam } from "@/components/ui";
import { awardValue, getPlayerRibbons, getRibbonClasses, ribbonFor, ribbonProgress } from "@/lib/awards";
import { fmtDuration, fmtNum, localeOf } from "@/lib/format";
import { getPlayerAwardWins } from "@/lib/history";
import { sortHeads } from "@/components/sort-head";
import { awardWinSorts, sortState } from "@/lib/table-sort";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histAwards}` };
}

// Every daily award the player won: a summary per award, then by date.
export default async function PlayerAwardsPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const p = await loadHistoryPlayer(game, id, "awards");
  const { lang, t } = await getDict();
  const { pageSize } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const order = sortState(sp, awardWinSorts, "date");
  const base = `/${game}/players/${p.playerId}/awards`;
  const keep = { ...order.keep, rows: limit !== pageSize ? limit : undefined };
  const th = sortHeads(order, base, keep);
  const [ribbons, classes, { rows, total }] = await Promise.all([
    getPlayerRibbons(p.playerId),
    getRibbonClasses(game),
    getPlayerAwardWins(p.playerId, limit, (page - 1) * limit, order.sort, order.asc),
  ]);
  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="awards">
      {ribbons.length ? (
        <>
          <table className="stats">
            <thead>
              <tr>
                <th>{t.awardsSummary}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div className="award-summary">
                    {ribbons.map((r) => (
                      <div key={r.awardId} className="award-sum-cell">
                        <b>{fmtNum(r.wins, lang)}×</b>
                        <Ribbon code={r.code} title={r.name} ribbon={ribbonFor(Number(r.wins), classes)} />
                        <RibbonLevel
                          progress={ribbonProgress(Number(r.wins), classes)}
                          className={(n) => ribbonClassName(n, lang)}
                          texts={{ toNext: t.ribbonToNext, maxed: t.ribbonMaxed }}
                        />
                      </div>
                    ))}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          <TableWrap>
            <table className="spaced">
              <thead>
                <tr>
                  {th(t.date, "date", "")}
                  {th(t.award, "award", "")}
                  {/* Values of different awards (kills, time, ...) do not compare. */}
                  <th>{t.description}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a, i) => (
                  <tr key={i}>
                    <td className="nowrap">{String(a.date).slice(0, 10)}</td>
                    <td>{a.name}</td>
                    <td>{awardValue(a, Number(a.winner_count), (n) => fmtNum(n, lang), fmtDuration)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager base={base} params={keep} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
        </>
      ) : (
        <Empty>{t.noHistory}</Empty>
      )}
    </HistoryFrame>
  );
}
