import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { sortHeads } from "@/components/sort-head";
import { Empty, PlayerLink, Section, Stats, TableWrap } from "@/components/ui";
import { gameHasShots, getWeapon, getWeaponTop, getPlayerFlags, type TopRow } from "@/lib/data";
import { fmtNum, fmtPct, ratio } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { sortRows, sortState } from "@/lib/table-sort";

// Columns of the top players (a kills, b headshots, c shots, d hits); most
// kills first, as loaded.
const topValues = {
  name: (r: TopRow) => r.name,
  kills: (r: TopRow) => Number(r.a),
  hs: (r: TopRow) => Number(r.b),
  hpk: (r: TopRow) => ratio(Number(r.b), Number(r.a)),
  shots: (r: TopRow) => Number(r.c),
  acc: (r: TopRow) => ratio(Number(r.d), Number(r.c)),
};

type Props = { params: Promise<{ game: string; code: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game, code } = await params;
  const w = await getWeapon(game, decodeURIComponent(code));
  if (!w) return {};
  return { title: `${(await getDict()).t.weapons}: ${w.name}` };
}

export default async function WeaponPage({ params, searchParams }: Props) {
  const { game, code } = await params;
  const w = await getWeapon(game, decodeURIComponent(code));
  if (!w) notFound();
  const { lang, t } = await getDict();
  // Counter-Strike 2 logs no shots: no shots and accuracy columns.
  const [loaded, shots] = await Promise.all([getWeaponTop(w.weaponId), gameHasShots(game)]);
  const flags = await getPlayerFlags(loaded.map((r) => r.playerId));
  const order = sortState(await searchParams, topValues, "kills");
  const top = sortRows(loaded, topValues, order.sort, order.asc);
  const th = sortHeads(order, `/${game}/weapons/${encodeURIComponent(w.code)}`, {});
  return (
    <>
      <Section title={w.name}>
        <Stats
          title={w.code}
          items={[
            [t.kills, fmtNum(w.kills, lang)],
            [t.hs, fmtNum(w.headshots, lang)],
            [t.hpk, fmtPct(ratio(w.headshots, w.kills), lang)],
            [t.modifier, fmtNum(w.modifier, lang, 2)],
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
                  {th(t.kills, "kills")}
                  {th(t.hs, "hs")}
                  {th(t.hpk, "hpk")}
                  {shots ? th(t.shots, "shots", "num hide-sm") : null}
                  {shots ? th(t.acc, "acc") : null}
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
                    <td className="num">{fmtPct(ratio(r.b, r.a), lang)}</td>
                    {shots ? <td className="num hide-sm">{fmtNum(r.c, lang)}</td> : null}
                    {shots ? <td className="num">{fmtPct(ratio(r.d, r.c), lang)}</td> : null}
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
