import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Empty, PlayerLink, Section, Stats, TableWrap } from "@/components/ui";
import { getAction, getActionTop, getPlayerFlags } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import { getDict } from "@/lib/i18n";

type Props = { params: Promise<{ game: string; id: string }> };

async function load(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? getAction(id) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load((await params).id);
  if (!a) return {};
  return { title: `${(await getDict()).t.actions}: ${a.description}` };
}

export default async function ActionPage({ params }: Props) {
  const { game, id } = await params;
  const a = await load(id);
  if (!a) notFound();
  if (a.game !== game) redirect(`/${a.game}/actions/${a.id}`);
  const { lang, t } = await getDict();
  const top = await getActionTop(a.id);
  const flags = await getPlayerFlags(top.map((r) => r.playerId));
  return (
    <>
      <Section title={a.description || a.code}>
        <Stats
          title={a.code}
          items={[
            [t.count, fmtNum(a.count, lang)],
            [`${t.reward} (${t.player})`, fmtNum(a.reward_player, lang)],
            [`${t.reward} (${t.team})`, fmtNum(a.reward_team, lang)],
          ]}
        />
      </Section>
      <Section title={t.topPlayers}>
        {top.length ? (
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>{t.player}</th>
                  <th className="num">{t.count}</th>
                  <th className="num">{t.points}</th>
                </tr>
              </thead>
              <tbody>
                {top.map((r, i) => (
                  <tr key={r.playerId}>
                    <td className="rank">{i + 1}</td>
                    <td>
                      <PlayerLink game={game} id={r.playerId} name={r.name} flag={flags.get(r.playerId)} />
                    </td>
                    <td className="num">{fmtNum(r.a, lang)}</td>
                    <td className="num">{fmtNum(r.b, lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <Empty>{t.noData}</Empty>
        )}
      </Section>
    </>
  );
}
