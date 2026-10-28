import Link from "next/link";
import { SortableTable } from "@/components/sortable-table";
import { PctBar, TableWrap } from "@/components/ui";
import { fmtNum, kpd, ratio } from "@/lib/format";
import type { Dict } from "@/translations";
import type { Lang } from "@/translations/languages";

// The tables gameME shows on the player page, shared by the player and the
// clan page so both look the same: map performance and weapon usage, each
// row with its share of all kills, deaths and headshots.

type MapRow = { id: number; map: string; kills: number | string; deaths: number | string; headshots: number | string };
type WeaponRow = { weaponId: number; code: string; name: string; kills: number | string; deaths: number | string; headshots: number | string };

const total = <T,>(rows: T[], k: keyof T) => rows.reduce((n, r) => n + Number(r[k]), 0);

export function MapTable({ maps, game, t, lang }: { maps: MapRow[]; game: string; t: Dict; lang: Lang }) {
  const [kills, hs] = [total(maps, "kills"), total(maps, "headshots")];
  return (
    <TableWrap>
      <SortableTable
        initial={1}
        cols={[
          { label: t.map },
          { label: t.kills, className: "num" },
          { label: t.killsShare, className: "barcell hide-sm", noSort: true },
          { label: t.deaths, className: "num" },
          { label: t.kpd, className: "num" },
          { label: t.hs, className: "num hide-sm" },
          { label: t.hsShare, className: "barcell hide-sm", noSort: true },
          { label: t.hpk, className: "barcell" },
        ]}
        rows={maps.map((m) => ({
          key: m.id,
          values: [m.map, Number(m.kills), null, Number(m.deaths), kpd(Number(m.kills), Number(m.deaths)), Number(m.headshots), null, ratio(Number(m.headshots), Number(m.kills))],
          cells: [
            <Link key="m" href={`/${game}/maps/${m.id}`}>
              {m.map}
            </Link>,
            fmtNum(Number(m.kills), lang),
            <PctBar key="k" value={ratio(Number(m.kills), kills)} lang={lang} tone="share" />,
            fmtNum(Number(m.deaths), lang),
            fmtNum(kpd(Number(m.kills), Number(m.deaths)), lang, 2),
            fmtNum(Number(m.headshots), lang),
            <PctBar key="hs" value={ratio(Number(m.headshots), hs)} lang={lang} tone="share" />,
            <PctBar key="h" value={ratio(Number(m.headshots), Number(m.kills))} lang={lang} />,
          ],
        }))}
      />
    </TableWrap>
  );
}

// members: the clan's member count, for a "per member" column.
export function WeaponUsage({ weapons, game, t, lang, members }: { weapons: WeaponRow[]; game: string; t: Dict; lang: Lang; members?: number }) {
  const [kills, deaths, hs] = [total(weapons, "kills"), total(weapons, "deaths"), total(weapons, "headshots")];
  const per = members !== undefined;
  return (
    <TableWrap>
      <SortableTable
        initial={1}
        cols={[
          { label: t.weapon },
          { label: t.kills, className: "num" },
          ...(per ? [{ label: t.perMember, className: "num hide-sm" }] : []),
          { label: t.killsShare, className: "barcell hide-sm", noSort: true },
          { label: t.deaths, className: "num hide-sm" },
          { label: t.deathsShare, className: "barcell hide-sm", noSort: true },
          { label: t.hs, className: "num hide-sm" },
          { label: t.hsShare, className: "barcell hide-sm", noSort: true },
          { label: t.hpk, className: "barcell" },
        ]}
        rows={weapons.map((w) => {
          const k = Number(w.kills);
          return {
            key: w.weaponId,
            values: [w.name, k, ...(per ? [members ? k / members : 0] : []), null, Number(w.deaths), null, Number(w.headshots), null, ratio(Number(w.headshots), k)],
            cells: [
              <Link key="n" href={`/${game}/weapons/${encodeURIComponent(w.code)}`}>
                {w.name}
              </Link>,
              fmtNum(k, lang),
              ...(per ? [fmtNum(members ? k / members : 0, lang, 1)] : []),
              <PctBar key="k" value={ratio(k, kills)} lang={lang} tone="share" />,
              fmtNum(Number(w.deaths), lang),
              <PctBar key="d" value={ratio(Number(w.deaths), deaths)} lang={lang} tone="share" />,
              fmtNum(Number(w.headshots), lang),
              <PctBar key="hs" value={ratio(Number(w.headshots), hs)} lang={lang} tone="share" />,
              <PctBar key="h" value={ratio(Number(w.headshots), k)} lang={lang} />,
            ],
          };
        })}
      />
    </TableWrap>
  );
}

// The labels of the weapon targets block (figure and table).
export function targetLabels(t: Dict) {
  return {
    head: t.head,
    neck: t.neck,
    chest: t.chest,
    stomach: t.stomach,
    leftarm: t.leftarm,
    rightarm: t.rightarm,
    leftleg: t.leftleg,
    rightleg: t.rightleg,
    weapon: t.weapon,
    hits: t.hits,
    show: t.show,
    targets: t.targets,
    left: t.sideLeft,
    middle: t.sideMiddle,
    right: t.sideRight,
    sidesHint: t.sidesHint,
  };
}

type WeaponDetail = WeaponRow & { shots: number | string; hits: number | string; damage: number | string };

// gameME's "Weapons": shots, hits, damage, accuracy, damage per hit and
// shots per kill. shots: the game logs shots (not Counter-Strike 2), else
// the columns that need them are left out.
export function WeaponStats({ weapons, game, shots, t, lang }: { weapons: WeaponDetail[]; game: string; shots: boolean; t: Dict; lang: Lang }) {
  // The columns that need shots or hits (shots, hits, accuracy, damage per
  // hit, shots per kill).
  const keep = <T,>(xs: T[]) => (shots ? xs : xs.filter((_, i) => ![1, 2, 9, 10, 11].includes(i)));
  return (
    <TableWrap>
      <SortableTable
        initial={shots ? 4 : 2}
        cols={keep([
          { label: t.weapon },
          { label: t.shots, className: "num hide-sm" },
          { label: t.hits, className: "num hide-sm" },
          { label: t.damage, className: "num hide-sm" },
          { label: t.kills, className: "num" },
          { label: t.deaths, className: "num hide-sm" },
          { label: t.kpd, className: "num" },
          { label: t.hs, className: "num hide-sm" },
          { label: t.hpk, className: "barcell" },
          { label: t.acc, className: "barcell" },
          { label: <abbr title={t.dphTitle}>{t.dph}</abbr>, className: "num hide-sm" },
          { label: <abbr title={t.spkTitle}>{t.spk}</abbr>, className: "num hide-sm" },
        ])}
        rows={weapons.map((w) => {
          const [sh, hi, dmg, k, d, hs] = [w.shots, w.hits, w.damage, w.kills, w.deaths, w.headshots].map(Number);
          const hpk = ratio(hs, k);
          const acc = ratio(hi, sh);
          const dph = hi ? dmg / hi : null;
          const spk = k ? sh / k : null;
          return {
            key: w.weaponId,
            values: keep([w.name, sh, hi, dmg, k, d, kpd(k, d), hs, hpk, acc, dph, spk]),
            cells: keep([
              <Link key="n" href={`/${game}/weapons/${encodeURIComponent(w.code)}`}>
                {w.name}
              </Link>,
              fmtNum(sh, lang),
              fmtNum(hi, lang),
              fmtNum(dmg, lang),
              fmtNum(k, lang),
              fmtNum(d, lang),
              fmtNum(kpd(k, d), lang, 2),
              fmtNum(hs, lang),
              <PctBar key="h" value={hpk} lang={lang} />,
              <PctBar key="a" value={acc} lang={lang} />,
              dph === null ? "-" : fmtNum(dph, lang, 2),
              spk === null ? "-" : fmtNum(spk, lang, 2),
            ]),
          };
        })}
      />
    </TableWrap>
  );
}
