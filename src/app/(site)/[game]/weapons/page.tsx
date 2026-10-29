import type { Metadata } from "next";
import Link from "next/link";
import { AutoForm } from "@/components/auto-form";
import { Rich } from "@/components/rich";
import { Empty, PctBar, Section, SortTh, TableWrap, strParam } from "@/components/ui";
import { noAutofill } from "@/lib/autofill";
import { getWeapons, type WeaponRow } from "@/lib/data";
import { fmtNum } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";
import { weaponShares, weaponTotals } from "@/lib/shares";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.weapons };
}

type SP = Promise<Record<string, string | string[] | undefined>>;

// Sort keys of the column heads and the select; default most kills first.
const SORTS: Record<string, (w: WeaponRow) => number | string> = {
  code: (w) => w.code.toLowerCase(),
  name: (w) => weaponName(w).toLowerCase(),
  modifier: (w) => Number(w.modifier),
  kills: (w) => Number(w.kills),
  headshots: (w) => Number(w.headshots),
  hpk: (w) => weaponShares(w, { kills: 0, headshots: 0 }).hpk,
};

// Full name; the code when the weapon has no name yet.
const weaponName = (w: WeaponRow) => w.name?.trim() || w.code;

// gameME's weapons list: weapon (gameME shows its image, we show the code;
// the images were removed again), full name, modifier, kills and headshots
// with their share of all, and headshots per kill, as small bars.
export default async function WeaponsPage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: SP }) {
  const { game } = await params;
  const sp = await searchParams;
  const { lang, t } = await getDict();
  const rows = await getWeapons(game);
  const rawSort = strParam(sp.sort);
  const sort = Object.hasOwn(SORTS, rawSort) ? rawSort : "kills";
  // Names read best A to Z, numbers biggest first; ?dir=asc flips it.
  const flipped = strParam(sp.dir) === "asc";
  const asc = flipped !== (sort === "name" || sort === "code");
  const key = SORTS[sort];
  const sorted = [...rows].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const c = typeof x === "string" ? x.localeCompare(String(y)) : x - Number(y);
    return (asc ? c : -c) || a.weaponId - b.weaponId;
  });
  const total = weaponTotals(rows);
  const base = `/${game}/weapons`;
  const sortProps = { current: sort, asc: flipped, base, params: { sort } };
  const th = (label: string, k: string, cls = "num") => <SortTh label={label} sortKey={k} className={cls} {...sortProps} />;
  const sortNames: [string, string][] = [
    ["kills", t.kills],
    ["headshots", t.headshotsLabel],
    ["hpk", t.hpkShort],
    ["modifier", t.modifier],
    ["code", t.weapon],
    ["name", t.name],
  ];

  return (
    <Section
      title={t.weapons}
      aside={
        <AutoForm action={base} className="search">
          <select {...noAutofill} name="sort" defaultValue={sort} aria-label={t.sortBy}>
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
            <Rich text={fill(t.weaponsTotal, { kills: fmtNum(total.kills, lang), hs: fmtNum(total.headshots, lang) })} />
          </p>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  {th(t.weapon, "code", "")}
                  {th(t.name, "name", "")}
                  {th(t.modifier, "modifier")}
                  {th(t.kills, "kills")}
                  <th className="barcell">{t.killsPct}</th>
                  {th(t.headshotsLabel, "headshots")}
                  <th className="barcell">{t.headshotsPct}</th>
                  {th(t.hpkShort, "hpk", "barcell")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((w, i) => {
                  const s = weaponShares(w, total);
                  return (
                    <tr key={w.weaponId}>
                      <td className="rank">{i + 1}</td>
                      <td>
                        <Link prefetch={false} className="player" href={`/${game}/weapons/${encodeURIComponent(w.code)}`}>
                          {w.code}
                        </Link>
                      </td>
                      <td>{weaponName(w)}</td>
                      <td className="num">{fmtNum(Number(w.modifier), lang, 2)}</td>
                      <td className="num">{fmtNum(Number(w.kills), lang)}</td>
                      <td className="barcell">
                        <PctBar value={s.killsPct} lang={lang} tone="share" />
                      </td>
                      <td className="num">{fmtNum(Number(w.headshots), lang)}</td>
                      <td className="barcell">
                        <PctBar value={s.headshotsPct} lang={lang} tone="share" />
                      </td>
                      <td className="barcell">
                        <PctBar value={s.hpk} lang={lang} />
                      </td>
                    </tr>
                  );
                })}
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
