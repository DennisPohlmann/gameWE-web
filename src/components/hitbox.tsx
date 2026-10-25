"use client";

import { useState } from "react";
import { noAutofill } from "@/lib/autofill";
import { ZONES, type Zone } from "@/lib/zones";
export type HitboxWeapon = { name: string; hits: Record<Zone, number> };

// Body shapes, facing the viewer: the player's left arm is on the right.
const SHAPES: Record<Zone, { d: string; lx: number; ly: number }> = {
  head: { d: "M100 12 a22 25 0 1 0 0.1 0 Z", lx: 100, ly: 42 },
  neck: { d: "M90 50 L110 50 L113 62 L87 62 Z", lx: 100, ly: 56 },
  chest: { d: "M66 64 Q100 56 134 64 L138 120 L62 120 Z", lx: 100, ly: 96 },
  stomach: { d: "M62 122 L138 122 L134 172 L66 172 Z", lx: 100, ly: 150 },
  rightarm: { d: "M62 66 L42 72 L28 150 L24 196 L40 198 L46 152 L60 112 Z", lx: 40, ly: 130 },
  leftarm: { d: "M138 66 L158 72 L172 150 L176 196 L160 198 L154 152 L140 112 Z", lx: 160, ly: 130 },
  // Leg labels one above the other, so two wide values never overlap.
  rightleg: { d: "M66 174 L98 174 L96 250 L92 330 L70 330 L70 250 Z", lx: 82, ly: 236 },
  leftleg: { d: "M102 174 L134 174 L130 250 L130 330 L108 330 L104 250 Z", lx: 118, ly: 276 },
};

// With a neck zone the head is drawn smaller, so the neck shows between head
// and chest.
const HEAD_WITH_NECK = "M100 10 a20 21 0 1 0 0.1 0 Z";

function heat(t: number): string {
  // t: the zone's hits relative to the most hit zone (0 to 1). Near black
  // for little, through dark red to bright red for the most hit zone; the
  // curve keeps rarely hit zones dark.
  const x = Math.pow(Math.min(1, Math.max(0, t)), 1.6);
  const r = Math.round(18 + x * 222);
  const g = Math.round(14 + x * 18);
  return `rgb(${r} ${g} ${g})`;
}

// Callouts: the zone label and its share beside the figure, joined by a line.
const CALLOUTS: Record<Zone, { side: "l" | "r"; ax: number; ay: number; y: number }> = {
  head: { side: "l", ax: 88, ay: 30, y: 34 },
  neck: { side: "l", ax: 92, ay: 54, y: 78 },
  rightarm: { side: "l", ax: 36, ay: 140, y: 120 },
  stomach: { side: "l", ax: 76, ay: 150, y: 196 },
  rightleg: { side: "l", ax: 80, ay: 290, y: 286 },
  chest: { side: "r", ax: 118, ay: 90, y: 74 },
  leftarm: { side: "r", ax: 164, ay: 140, y: 156 },
  leftleg: { side: "r", ax: 120, ay: 250, y: 250 },
};

export function Hitbox({
  weapons,
  labels,
  locale,
  initial = 0,
}: {
  weapons: HitboxWeapon[];
  labels: Record<Zone, string> & { weapon: string; hits: string; show: string };
  locale: string;
  // Weapon chosen through ?hw= (the form below works without JavaScript too).
  initial?: number;
}) {
  const [sel, setSel] = useState(initial);
  const [hover, setHover] = useState<Zone | null>(null);
  const w = weapons[sel] ?? weapons[0];
  if (!w) return null;
  // neck only for games that log it (Counter-Strike 2): shown when any
  // weapon has neck hits.
  const neck = weapons.some((x) => (x.hits.neck ?? 0) > 0);
  const zones = ZONES.filter((z) => z !== "neck" || neck);
  const total = zones.reduce((s, z) => s + w.hits[z], 0);
  const pct = (z: Zone) => (total ? w.hits[z] / total : 0);
  const fmtPct = (v: number) => `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
  // Colours relative to the most hit zone, so the spread stays visible.
  const top = Math.max(0, ...zones.map(pct));
  const hoverProps = (z: Zone) => ({ onMouseEnter: () => setHover(z), onMouseLeave: () => setHover(null) });
  const cls = (z: Zone, base: string) => (hover === z ? `${base} active` : base);

  // The figure; dx shifts it right to make room for callouts on the left.
  const figure = (dx: number) => (
    <>
      <g transform={`translate(${dx} 0)`}>
        <g>
          {zones.map((z) => (
            <path key={z} d={z === "head" && neck ? HEAD_WITH_NECK : SHAPES[z].d} fill={heat(top ? pct(z) / top : 0)} className={cls(z, "zone")} {...hoverProps(z)}>
              <title>{`${labels[z]}: ${w.hits[z].toLocaleString(locale)} (${fmtPct(pct(z))})`}</title>
            </path>
          ))}
        </g>
      </g>
    </>
  );


  const picker = (
    <form method="get" className="hb-picker">
      <label>
        <span>{labels.weapon}</span>
        <select {...noAutofill} name="hw" value={sel} onChange={(e) => setSel(Number(e.target.value))}>
          {weapons.map((x, i) => (
            <option key={`${i}-${x.name}`} value={i}>
              {x.name}
            </option>
          ))}
        </select>
      </label>
      <noscript>
        <button type="submit">{labels.show}</button>
      </noscript>
      <span className="hb-total">
        {labels.hits}: <b>{total.toLocaleString(locale)}</b>
      </span>
    </form>
  );

  const legend = (
    <div className="hb-legend" aria-hidden="true">
      <span>0 %</span>
      <i style={{ background: `linear-gradient(90deg, ${heat(0)}, ${heat(0.5)}, ${heat(0.75)}, ${heat(1)})` }} />
      <span>{fmtPct(top)}</span>
    </div>
  );

  const W = 360;
  const dx = 80;
  return (
    <div className="hitbox hb-callout">
      {picker}
      <svg viewBox={`0 0 ${W} 340`} role="img" aria-label={`${labels.hits}: ${w.name}`}>
        {figure(dx)}
        {zones.map((z) => {
          const c = CALLOUTS[z];
          const ax = c.ax + dx;
          const ex = c.side === "l" ? 74 : W - 74;
          const tx = c.side === "l" ? 4 : W - 4;
          const anchor = c.side === "l" ? "start" : "end";
          return (
            <g key={z} className={cls(z, "hb-call")} {...hoverProps(z)}>
              <polyline points={`${ax},${c.ay} ${ex + (c.side === "l" ? 6 : -6)},${c.y} ${ex},${c.y}`} className="hb-line" />
              <circle cx={ax} cy={c.ay} r="2.5" className="hb-dot" />
              <text x={tx} y={c.y - 4} textAnchor={anchor} className="hb-name">
                {labels[z]}
              </text>
              <text x={tx} y={c.y + 12} textAnchor={anchor} className="hb-pct">
                {fmtPct(pct(z))}
              </text>
              <text x={tx} y={c.y + 24} textAnchor={anchor} className="hb-hits">
                {w.hits[z].toLocaleString(locale)} {labels.hits}
              </text>
            </g>
          );
        })}
      </svg>
      {legend}
    </div>
  );
}
