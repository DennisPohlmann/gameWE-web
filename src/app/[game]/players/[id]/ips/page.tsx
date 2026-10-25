import type { Metadata } from "next";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, TableWrap } from "@/components/ui";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { getPlayerIps } from "@/lib/history";
import { getDict } from "@/lib/i18n";
import { sortHeads } from "@/components/sort-head";
import { ipSortKey, sortRows, sortState } from "@/lib/table-sort";
import type { PlayerIp } from "@/lib/history";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

// Columns of the address list; the last connect first, as loaded.
const ipValues = {
  last: (r: PlayerIp) => r.last,
  first: (r: PlayerIp) => r.first,
  connects: (r: PlayerIp) => r.connects,
  ip: (r: PlayerIp) => ipSortKey(r.ip),
  host: (r: PlayerIp) => r.hostname,
};

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histIps}`, robots: { index: false, follow: false } };
}

// The addresses a player connected from. loadHistoryPlayer answers 404 to
// anyone who is not signed in as admin.
export default async function PlayerIpsPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const p = await loadHistoryPlayer(game, id, "ips");
  const { lang, t } = await getDict();
  const order = sortState(await searchParams, ipValues, "last");
  const rows = sortRows(await getPlayerIps(p.playerId), ipValues, order.sort, order.asc);
  const th = sortHeads(order, `/${game}/players/${p.playerId}/ips`, {});
  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="ips">
      <p className="muted">{t.ipAdminOnly}</p>
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                {th(t.ipAddress, "ip", "")}
                {th(t.connections, "connects")}
                {th(t.firstConnect, "first", "hide-sm")}
                {th(t.lastConnect, "last", "")}
                {th(t.ipHost, "host", "hide-sm")}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.ip + r.first}>
                  <td className="nowrap">{r.ip}</td>
                  <td className="num">{fmtNum(r.connects, lang)}</td>
                  <td className="hide-sm muted nowrap">{fmtDateTime(r.first, lang)}</td>
                  <td className="muted nowrap">{fmtDateTime(r.last, lang)}</td>
                  <td className="hide-sm muted wrap-cell">{r.hostname || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </HistoryFrame>
  );
}
