"use client";

import { useId, useState } from "react";
import { noAutofill } from "@/lib/autofill";
import { ZONES, type Zone } from "@/lib/zones";
import { ltrDate } from "@/lib/format";
export type HitboxWeapon = { name: string; hits: Record<Zone, number> };

// Body shapes, facing the viewer: the player's left arm is on the right.
// Rounded like a mannequin; each part gets a light from the top left and a
// shadow on its far side (LIGHT below), so the figure looks solid.
const SHAPES: Record<Zone, { d: string; lx: number; ly: number }> = {
  head: { d: "M100 11 C114 11 123 22 123 36 C123 51 113 61 100 61 C87 61 77 51 77 36 C77 22 86 11 100 11 Z", lx: 100, ly: 42 },
  neck: { d: "M89 50 C95 53 105 53 111 50 L114 64 C106 67 94 67 86 64 Z", lx: 100, ly: 56 },
  chest: { d: "M62 72 C64 62 80 59 100 59 C120 59 136 62 138 72 C141 88 141 104 138 120 C124 125 76 125 62 120 C59 104 59 88 62 72 Z", lx: 100, ly: 96 },
  stomach: { d: "M62 123 C78 127 122 127 138 123 C137 140 136 156 134 171 C120 177 80 177 66 171 C64 156 63 140 62 123 Z", lx: 100, ly: 150 },
  rightarm: { d: "M58 68 C46 68 40 76 38 88 C34 108 30 128 28 150 C26 166 24 182 25 194 C27 201 38 201 40 195 C42 182 44 166 47 152 C51 136 56 122 60 110 Z", lx: 40, ly: 130 },
  leftarm: { d: "M142 68 C154 68 160 76 162 88 C166 108 170 128 172 150 C174 166 176 182 175 194 C173 201 162 201 160 195 C158 182 156 166 153 152 C149 136 144 122 140 110 Z", lx: 160, ly: 130 },
  // Leg labels one above the other, so two wide values never overlap.
  rightleg: { d: "M66 174 C78 178 92 179 98 177 C98 202 97 226 96 250 C95 278 94 306 93 326 C88 333 74 333 70 326 C69 300 68 274 68 250 C67 224 66 198 66 174 Z", lx: 82, ly: 236 },
  leftleg: { d: "M134 174 C122 178 108 179 102 177 C102 202 103 226 104 250 C105 278 106 306 107 326 C112 333 126 333 130 326 C131 300 132 274 132 250 C133 224 134 198 134 174 Z", lx: 118, ly: 276 },
};

// With a neck zone the head is drawn smaller, so the neck shows between head
// and chest.
const HEAD_WITH_NECK = "M100 9 C112 9 120 19 120 31 C120 44 111 52 100 52 C89 52 80 44 80 31 C80 19 88 9 100 9 Z";

// Back to front: limbs behind the torso, the head last, so parts overlap
// like a body.
const DRAW_ORDER: Zone[] = ["rightarm", "leftarm", "rightleg", "leftleg", "stomach", "chest", "neck", "head"];

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
  selected,
  onSelect,
}: {
  weapons: HitboxWeapon[];
  labels: Record<Zone, string> & { weapon: string; hits: string; show: string };
  locale: string;
  // Weapon chosen through ?hw= (the form below works without JavaScript too).
  initial?: number;
  // Controlled from outside (the weapon table beside it, see WeaponTargets).
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  const [own, setOwn] = useState(initial);
  const sel = selected ?? own;
  const setSel = onSelect ?? setOwn;
  const [hover, setHover] = useState<Zone | null>(null);
  const w = weapons[sel] ?? weapons[0];
  if (!w) return null;
  // neck only for games that log it (Counter-Strike 2): shown when any
  // weapon has neck hits.
  const neck = weapons.some((x) => (x.hits.neck ?? 0) > 0);
  const zones = ZONES.filter((z) => z !== "neck" || neck);
  const total = zones.reduce((s, z) => s + w.hits[z], 0);
  const pct = (z: Zone) => (total ? w.hits[z] / total : 0);
  const fmtPct = (v: number) => ltrDate(locale, `${(v * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %`);
  // Colours relative to the most hit zone, so the spread stays visible.
  const top = Math.max(0, ...zones.map(pct));
  const hoverProps = (z: Zone) => ({ onMouseEnter: () => setHover(z), onMouseLeave: () => setHover(null) });
  const cls = (z: Zone, base: string) => (hover === z ? `${base} active` : base);

  // Ids of the gradients and filters, unique per figure on the page.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const shape = (z: Zone) => (z === "head" && neck ? HEAD_WITH_NECK : SHAPES[z].d);
  // The figure; dx shifts it right to make room for callouts on the left.
  // Every part is its heat colour, then a light (bright top left, dark
  // bottom right) and a soft rim on top; a blurred shadow lies under the feet.
  const figure = (dx: number) => (
    <>
      <defs>
        <radialGradient id={`${id}-light`} cx="0.32" cy="0.22" r="0.95">
          <stop offset="0" stopColor="#fff" stopOpacity="0.42" />
          <stop offset="0.35" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.7" stopColor="#000" stopOpacity="0.12" />
          <stop offset="1" stopColor="#000" stopOpacity="0.5" />
        </radialGradient>
        <filter id={`${id}-drop`} x="-20%" y="-10%" width="140%" height="130%">
          <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <filter id={`${id}-floor`} x="-50%" y="-200%" width="200%" height="500%">
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <g transform={`translate(${dx} 0)`}>
        <ellipse cx="100" cy="332" rx="46" ry="6" className="hb-floor" filter={`url(#${id}-floor)`} />
        <g filter={`url(#${id}-drop)`}>
          {DRAW_ORDER.filter((z) => zones.includes(z)).map((z) => (
            <g key={z} className={cls(z, "zone")} {...hoverProps(z)}>
              <path d={shape(z)} fill={heat(top ? pct(z) / top : 0)} />
              <path d={shape(z)} fill={`url(#${id}-light)`} className="zone-light" />
              <title>{`${labels[z]}: ${w.hits[z].toLocaleString(locale)} (${fmtPct(pct(z))})`}</title>
            </g>
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
            <option key={`${i}-${x.name}`} value={i} dir="auto">
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
