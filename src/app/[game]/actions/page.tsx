import type { Metadata } from "next";
import Link from "next/link";
import { Bar, Empty, Section, TableWrap } from "@/components/ui";
import { getActions } from "@/lib/data";
import { fmtNum, fmtPct, ratio } from "@/lib/format";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.actions };
}

export default async function ActionsPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const { lang, t } = await getDict();
  const rows = await getActions(game);
  const total = rows.reduce((s, a) => s + a.count, 0);
  return (
    <Section title={t.actions}>
      {rows.length ? (
        <TableWrap>
          <table>
            <thead>
              <tr>
                <th className="num">#</th>
                <th>{t.actions}</th>
                <th className="num">{t.count}</th>
                <th className="barcell">{t.share}</th>
                <th className="num">{t.reward}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a, i) => (
                <tr key={a.id}>
                  <td className="rank">{i + 1}</td>
                  <td>
                    <Link className="player" href={`/${game}/actions/${a.id}`}>
                      {a.description || a.code}
                    </Link>
                  </td>
                  <td className="num">{fmtNum(a.count, lang)}</td>
                  <td className="barcell">
                    <Bar value={ratio(a.count, total)} label={fmtPct(ratio(a.count, total), lang, 1)} />
                  </td>
                  <td className="num">{fmtNum(a.reward_player || a.reward_team, lang)}</td>
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
