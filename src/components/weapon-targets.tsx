"use client";

import { useState } from "react";
import { Hitbox, type HitboxWeapon } from "@/components/hitbox";
import { SortableTable } from "@/components/sortable-table";
import type { Zone } from "@/lib/zones";

type Labels = Record<Zone, string> & {
  weapon: string;
  hits: string;
  show: string;
  targets: string;
  left: string;
  middle: string;
  right: string;
  sidesHint: string;
};

// gameME's "Weapon Targets": the figure in a box on the left, beside it the
// weapons with their hits and how they spread over the left side, the middle
// and the right side of the body. A click on a weapon shows it in the
// figure; without JavaScript the link does the same through ?hw=. The same
// block on the player and the clan page. weapons[0] is all weapons together.
export function WeaponTargets({ weapons, labels, locale, initial = 0 }: { weapons: HitboxWeapon[]; labels: Labels; locale: string; initial?: number }) {
  const [sel, setSel] = useState(initial);
  const sum = (w: HitboxWeapon, zones: Zone[]) => zones.reduce((n, z) => n + (w.hits[z] ?? 0), 0);
  const pct = (part: number, total: number) => (total ? `${((part / total) * 100).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` : "-");
  const rows = weapons.map((w, i) => {
    const total = sum(w, ["head", "neck", "chest", "stomach", "leftarm", "rightarm", "leftleg", "rightleg"]);
    const left = sum(w, ["leftarm", "leftleg"]);
    const right = sum(w, ["rightarm", "rightleg"]);
    const middle = total - left - right;
    return {
      key: i,
      className: i === sel ? "wt-sel" : undefined,
      values: [i === 0 ? null : w.name, total, total ? left / total : null, total ? middle / total : null, total ? right / total : null],
      cells: [
        <a
          key="w"
          href={`?hw=${i}#targets`}
          className={i === 0 ? "wt-all" : undefined}
          aria-current={i === sel ? "true" : undefined}
          onClick={(e) => {
            e.preventDefault();
            setSel(i);
          }}
        >
          {w.name}
        </a>,
        total.toLocaleString(locale),
        pct(left, total),
        pct(middle, total),
        pct(right, total),
      ],
    };
  });
  return (
    <div className="cont-2 wt">
      <table className="stats wt-figure">
        <thead>
          <tr>
            <th>{labels.targets}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <Hitbox weapons={weapons} labels={labels} locale={locale} selected={sel} onSelect={setSel} />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="table-wrap wt-table">
        <SortableTable
          initial={1}
          cols={[
            { label: labels.weapon },
            { label: labels.hits, className: "num" },
            { label: <abbr title={labels.sidesHint}>{labels.left}</abbr>, className: "num" },
            { label: <abbr title={labels.sidesHint}>{labels.middle}</abbr>, className: "num" },
            { label: <abbr title={labels.sidesHint}>{labels.right}</abbr>, className: "num" },
          ]}
          rows={rows}
        />
      </div>
    </div>
  );
}
