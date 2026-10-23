import type { Metadata } from "next";
import Link from "next/link";
import { Bar, Empty, Section, TableWrap } from "@/components/ui";
import { getMaps } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, ratio } from "@/lib/format";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.maps };
}

export default async function MapsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const { lang, t } = await getDict();
  const rows = await getMaps(game);
  const total = rows.reduce((s, m) => s + m.kills, 0);
  const hasTime = rows.some((m) => m.play_time > 0);
  return (
    <Section title={t.maps} aside={`${fmtNum(total, lang)} ${t.kills}`}>
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>{t.map}</th>
                <th className="num">{t.played}</th>
                {hasTime ? <th className="num hide-sm">{t.time}</th> : null}
                <th className="num hide-sm">{t.rounds}</th>
                <th className="num">{t.kills}</th>
                <th className="barcell">{t.share}</th>
                <th className="num">{t.hs}</th>
                <th className="num">{t.hpk}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={m.id}>
                  <td className="rank">{i + 1}</td>
                  <td>
                    <Link className="player" href={`/${game}/maps/${m.id}`}>
                      {m.map}
                    </Link>
                  </td>
                  <td className="num">{fmtNum(m.played, lang)}</td>
                  {hasTime ? <td className="num hide-sm">{fmtDuration(m.play_time)}</td> : null}
                  <td className="num hide-sm">{fmtNum(m.rounds, lang)}</td>
                  <td className="num">{fmtNum(m.kills, lang)}</td>
                  <td className="barcell">
                    <Bar value={ratio(m.kills, total)} label={fmtPct(ratio(m.kills, total), lang, 1)} />
                  </td>
                  <td className="num">{fmtNum(m.headshots, lang)}</td>
                  <td className="num">{fmtPct(ratio(m.headshots, m.kills), lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </Section>
  );
}
