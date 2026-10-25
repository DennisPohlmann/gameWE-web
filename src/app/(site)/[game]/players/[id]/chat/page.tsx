import type { Metadata } from "next";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, Pager, ROW_OPTIONS, TableWrap, pageParam, rowsParam } from "@/components/ui";
import { countChat, getChat } from "@/lib/data";
import { fmtDateTime, localeOf } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { getSettings } from "@/lib/settings";
import { sortHeads } from "@/components/sort-head";
import { sortState, timeSorts } from "@/lib/table-sort";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histChat}` };
}

export default async function PlayerChatPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const p = await loadHistoryPlayer(game, id, "chat");
  const { lang, t } = await getDict();
  const { pageSize } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const order = sortState(sp, timeSorts, "date");
  const [rows, total] = await Promise.all([getChat({ playerId: p.playerId, limit, offset: (page - 1) * limit, asc: order.asc }), countChat({ playerId: p.playerId })]);
  const base = `/${game}/players/${p.playerId}/chat`;
  const keep = { ...order.keep, rows: limit !== pageSize ? limit : undefined };
  const th = sortHeads(order, base, keep);
  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="chat">
      {rows.length ? (
        <>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  {th(t.time, "date", "")}
                  <th>{t.message}</th>
                  <th className="hide-sm">{t.server}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((c, i) => (
                  <tr key={i}>
                    <td className="muted nowrap">{fmtDateTime(c.timestamp_id, lang)}</td>
                    <td className="wrap-cell">
                      {c.message_mode === 2 ? <span className="muted">({t.sayTeam}) </span> : null}
                      {c.message}
                    </td>
                    <td className="hide-sm muted">{c.server ?? "-"}</td>
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
