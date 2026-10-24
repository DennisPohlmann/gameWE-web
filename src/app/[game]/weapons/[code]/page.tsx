import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Empty, PlayerLink, Section, Stats, TableWrap } from "@/components/ui";
import { Weapon } from "@/components/weapon";
import { getGame, getWeapon, getWeaponTop, getPlayerFlags } from "@/lib/data";
import { fmtNum, fmtPct, ratio } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { weaponImages } from "@/lib/weapons";

type Props = { params: Promise<{ game: string; code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game, code } = await params;
  const w = await getWeapon(game, decodeURIComponent(code));
  if (!w) return {};
  return { title: `${(await getDict()).t.weapons}: ${w.name}` };
}

export default async function WeaponPage({ params }: Props) {
  const { game, code } = await params;
  const w = await getWeapon(game, decodeURIComponent(code));
  if (!w) notFound();
  const { lang, t } = await getDict();
  const [top, g] = await Promise.all([getWeaponTop(w.weaponId), getGame(game, true)]);
  const images = weaponImages(g?.realgame);
  const flags = await getPlayerFlags(top.map((r) => r.playerId));
  return (
    <>
      <Section title={w.name}>
        <Stats
          title={images && Object.hasOwn(images.sizes, w.code.toLowerCase()) ? <Weapon set={images} code={w.code} name={w.name} height={30} /> : w.code}
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
                  <th>{t.player}</th>
                  <th className="num">{t.kills}</th>
                  <th className="num">{t.hs}</th>
                  <th className="num">{t.hpk}</th>
                  <th className="num hide-sm">{t.shots}</th>
                  <th className="num">{t.acc}</th>
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
                    <td className="num hide-sm">{fmtNum(r.c, lang)}</td>
                    <td className="num">{fmtPct(ratio(r.d, r.c), lang)}</td>
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
