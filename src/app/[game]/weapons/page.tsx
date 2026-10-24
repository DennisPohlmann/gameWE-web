import type { Metadata } from "next";
import Link from "next/link";
import { AutoForm } from "@/components/auto-form";
import { Rich } from "@/components/rich";
import { Empty, PctBar, Section, SortTh, TableWrap, strParam } from "@/components/ui";
import { Weapon } from "@/components/weapon";
import { getGame, getWeapons, type WeaponRow } from "@/lib/data";
import { fmtNum, ratio } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";
import { weaponImages } from "@/lib/weapons";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.weapons };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

// Sort keys of the column heads and the select; default most kills first.
const SORTS: Record<string, (w: WeaponRow) => number | string> = {
  name: (w) => w.name.toLowerCase(),
  modifier: (w) => Number(w.modifier),
  kills: (w) => Number(w.kills),
  headshots: (w) => Number(w.headshots),
  hpk: (w) => ratio(Number(w.headshots), Number(w.kills)) ?? 0,
};

// gameME's weapons list: kills and headshots with their share of all, and
// headshots per kill, as small bars.
export default async function WeaponsPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: SP }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const [rows, g] = await Promise.all([getWeapons(game), getGame(game, true)]);
  const images = weaponImages(g?.realgame);
  const rawSort = strParam(sp.sort);
  const sort = Object.hasOwn(SORTS, rawSort) ? rawSort : "kills";
  // Names read best A to Z, numbers biggest first; ?dir=asc flips it.
  const flipped = strParam(sp.dir) === "asc";
  const asc = flipped !== (sort === "name");
  const key = SORTS[sort];
  const sorted = [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return (asc ? c : -c) || a.weaponId - b.weaponId;
  });
  const kills = rows.reduce((s, w) => s + Number(w.kills), 0);
  const hs = rows.reduce((s, w) => s + Number(w.headshots), 0);
  const base = `/${game}/weapons`;
  const sortProps = { current: sort, asc: flipped, base, params: { sort } };
  const th = (label: string, k: string, cls = "num") => <SortTh label={label} sortKey={k} className={cls} {...sortProps} />;
  const sortNames: [string, string][] = [
    ["kills", t.kills],
    ["headshots", t.headshotsLabel],
    ["hpk", t.hpk],
    ["modifier", t.modifier],
    ["name", t.name],
  ];

  return (
    <Section
      title={t.weapons}
      aside={
        <AutoForm action={base} className="search">
          <select name="sort" defaultValue={sort} aria-label={t.sortBy}>
            {sortNames.map(([k, label]) => (
              <option key={k} value={k}>
                {t.sortBy}: {label}
              </option>
            ))}
          </select>
          <button type="submit">{t.show}</button>
        </AutoForm>
      }
    >
      {rows.length ? (
        <>
          <p className="lead">
            <Rich text={fill(t.weaponsTotal, { kills: fmtNum(kills, lang), hs: fmtNum(hs, lang) })} />
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  {th(t.name, "name", "")}
                  {th(t.modifier, "modifier", "num hide-sm")}
                  {th(t.kills, "kills")}
                  <th className="barcell">{t.killsPct}</th>
                  {th(t.headshotsLabel, "headshots", "num hide-sm")}
                  <th className="barcell hide-sm">{t.headshotsPct}</th>
                  {th(t.hpk, "hpk", "barcell")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((w, i) => (
                  <tr key={w.weaponId}>
                    <td className="rank">{i + 1}</td>
                    <td>
                      <Link className="player" href={`/${game}/weapons/${encodeURIComponent(w.code)}`}>
                        <Weapon set={images} code={w.code} name={w.name} />
                      </Link>
                    </td>
                    <td className="num hide-sm">{fmtNum(Number(w.modifier), lang, 2)}</td>
                    <td className="num">{fmtNum(Number(w.kills), lang)}</td>
                    <td className="barcell">
                      <PctBar value={ratio(Number(w.kills), kills)} lang={lang} tone="share" />
                    </td>
                    <td className="num hide-sm">{fmtNum(Number(w.headshots), lang)}</td>
                    <td className="barcell hide-sm">
                      <PctBar value={ratio(Number(w.headshots), hs)} lang={lang} tone="share" />
                    </td>
                    <td className="barcell">
                      <PctBar value={ratio(Number(w.headshots), Number(w.kills))} lang={lang} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </Section>
  );
}
