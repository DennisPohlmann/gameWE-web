import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { sortHeads } from "@/components/sort-head";
import { Empty, PlayerLink, Section, Stats, TableWrap } from "@/components/ui";
import { getAction, getActionTop, getPlayerFlags, type TopRow } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { sortRows, sortState } from "@/lib/table-sort";

// Columns of the top players (a count, b points); most often first, as loaded.
const topValues = {
  name: (r: TopRow) => r.name,
  count: (r: TopRow) => Number(r.a),
  points: (r: TopRow) => Number(r.b),
};

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? getAction(id) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await load((await params).id);
  if (!a) return {};
  return { title: `${(await getDict()).t.actions}: ${a.description}` };
}

export default async function ActionPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const a = await load(id);
  if (!a) notFound();
  if (a.game !== game) redirect(`/${a.game}/actions/${a.id}`);
  const { lang, t } = await getDict();
  const loaded = await getActionTop(a.id);
  const flags = await getPlayerFlags(loaded.map((r) => r.playerId));
  const order = sortState(await searchParams, topValues, "count");
  const top = sortRows(loaded, topValues, order.sort, order.asc);
  const th = sortHeads(order, `/${game}/actions/${a.id}`, {});
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
                  {th(t.player, "name", "")}
                  {th(t.count, "count")}
                  {th(t.points, "points")}
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
