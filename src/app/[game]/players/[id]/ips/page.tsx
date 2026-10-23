import type { Metadata } from "next";
import { HistoryFrame, loadHistoryPlayer } from "@/components/player-history";
import { Empty, TableWrap } from "@/components/ui";
import { fmtDateTime, fmtNum } from "@/lib/format";
import { getPlayerIps } from "@/lib/history";
import { getDict } from "@/lib/i18n";

type Props = { params: Promise<{ game: string; id: string }> };

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getDict();
  return { title: `${t.playerHistory}: ${t.histIps}`, robots: { index: false, follow: false } };
}

// The addresses a player connected from. loadHistoryPlayer answers 404 to
// anyone who is not signed in as admin.
export default async function PlayerIpsPage({ params }: Props) {
  const { game, id } = await params;
  const p = await loadHistoryPlayer(game, id, "ips");
  const { lang, t } = await getDict();
  const rows = await getPlayerIps(p.playerId);
  return (
    <HistoryFrame game={game} id={p.playerId} name={p.name} t={t} tab="ips">
      <p className="muted">{t.ipAdminOnly}</p>
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th>{t.ipAddress}</th>
                <th className="num">{t.connections}</th>
                <th className="hide-sm">{t.firstConnect}</th>
                <th>{t.lastConnect}</th>
                <th className="hide-sm">{t.ipHost}</th>
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
