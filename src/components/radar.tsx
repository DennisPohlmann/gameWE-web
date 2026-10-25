"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

// Profile radar: one axis per stat, the players' average polygon and the
// player on top (both over the last two weeks, see lib/radar.ts). Hovering,
// tapping or focusing an axis (Tab, then the arrow keys) highlights it and
// shows its values and scale in a box. Colours come from the template's
// chart.json (radar.total for the average, radar.current for the player),
// see globals.css. An axis without data for the player sits greyed at the
// centre. The average's outline and points are drawn over the player's
// shape, so both stay visible when they are equal.

export type RadarAxis = {
  label: string;
  avg: number; // radius 0..1
  player: number | null;
  avgText: string; // "1.42"
  playerText: string;
  relation: string; // "34 % above average" or "no data"
  scale: string; // "middle ring = average, outer = 2× average" or "scale 0–3"
  noData?: boolean;
};

const C = 110;
const R = 70;

export function Radar({ axes, labels, notes = [] }: { axes: RadarAxis[]; labels: { avg: string; player: string }; notes?: string[] }) {
  const [active, setActive] = useState<number | null>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // The box stays on the screen: shifted sideways when it would stick out.
  useLayoutEffect(() => {
    const el = tipRef.current;
    if (!el) return;
    el.style.marginLeft = "0px";
    const r = el.getBoundingClientRect();
    const over = r.left < 4 ? 4 - r.left : r.right > window.innerWidth - 4 ? window.innerWidth - 4 - r.right : 0;
    el.style.marginLeft = `${over}px`;
  }, [active]);
  const n = axes.length;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, v: number) => {
    const k = Math.max(0.03, Math.min(1, v)) * R;
    return [C + k * Math.cos(angle(i)), C + k * Math.sin(angle(i))];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  const describe = (a: RadarAxis) =>
    `${a.label}: ${labels.player} ${a.playerText}, ${a.relation}; ${labels.avg} ${a.avgText}; ${a.scale}`;

  // Fewer than three axes make no polygon: the values as a list.
  if (n < 3) {
    return (
      <dl className="radar-list">
        {axes.map((a) => (
          <div key={a.label}>
            <dt>{a.label}</dt>
            <dd>
              {a.playerText}
              <span className="muted"> ({labels.avg} {a.avgText})</span>
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  const hasPlayer = axes.some((a) => a.player !== null);
  // Each axis owns the wedge up to half way to its neighbours, so the pointer
  // anywhere in the chart picks the nearest axis.
  const wedge = (i: number) => {
    const half = Math.PI / n;
    const p = (a: number) => `${(C + R * 1.45 * Math.cos(a)).toFixed(1)},${(C + R * 1.45 * Math.sin(a)).toFixed(1)}`;
    return `${C},${C} ${p(angle(i) - half)} ${p(angle(i))} ${p(angle(i) + half)}`;
  };
  const onKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (e.key === "Escape") return setActive(null);
    if (!step) return;
    e.preventDefault();
    const next = (i + step + n) % n;
    const el = e.currentTarget.parentElement?.querySelectorAll<SVGGElement>(".radar-axis")[next];
    el?.focus();
  };
  const tip = active === null ? null : axes[active];
  // The box never covers the label of the axis it describes: for an axis at
  // the side it sits above the label when the label is in the lower half and
  // below it in the upper half; for the axis at the top or bottom it sits
  // beyond the label.
  const [lx, ly] = active === null ? [C, C] : pt(active, 1.28);
  const side = Math.abs(lx - C) > 5;
  const [tx, ty] = active === null ? [0, 0] : side ? [lx, ly > C ? ly - 9 : ly + 7] : pt(active, 1.42);
  const place = side ? (ly > C ? "up" : "down") : ty < C ? "up" : "down";

  return (
    <div
      className="radar-wrap"
      // A finger leaves right after the tap: there the box stays until focus moves away.
      onPointerLeave={(e: PointerEvent) => e.pointerType !== "touch" && setActive(null)}
    >
      <svg className="radar" viewBox="0 0 220 220" role="group" aria-label={`${labels.player} / ${labels.avg}`}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <polygon key={g} className="radar-grid" points={poly(axes.map(() => g))} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} className={i === active ? "radar-grid on" : "radar-grid"} x1={C} y1={C} x2={x} y2={y} />;
        })}
        <polygon className="radar-total" points={poly(axes.map((a) => a.avg))} />
        {hasPlayer ? <polygon className="radar-current" points={poly(axes.map((a) => a.player ?? 0))} /> : null}
        {hasPlayer ? <polygon className="radar-total-line" points={poly(axes.map((a) => a.avg))} /> : null}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.28);
          const [px, py] = pt(i, a.avg);
          const cur = a.player === null || a.noData ? null : pt(i, a.player);
          const on = i === active;
          return (
            <g
              key={a.label}
              className={`radar-axis${on ? " on" : ""}${a.noData ? " nodata" : ""}`}
              tabIndex={0}
              role="img"
              aria-label={describe(a)}
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive((v) => (v === i ? null : v))}
              onKeyDown={(e) => onKey(e, i)}
            >
              <polygon className="radar-hit" points={wedge(i)} />
              {/* The average's dot is the larger one: on an equal player dot
                  it stays visible as a ring. */}
              {a.avg > 0 ? <circle className="radar-dot total" cx={px} cy={py} r={on ? 5.5 : cur ? 4 : 2.5} /> : null}
              {cur ? <circle className="radar-dot current" cx={cur[0]} cy={cur[1]} r={on ? 3 : 2} /> : null}
              <text className="radar-label" x={x} y={y + 3} textAnchor={x < C - 5 ? "end" : x > C + 5 ? "start" : "middle"}>
                {a.label}
              </text>
            </g>
          );
        })}
      </svg>
      {tip ? (
        <div
          ref={tipRef}
          className={`chart-tip radar-tip ${place}`}
          style={{ left: `${(tx / 220) * 100}%`, top: `${(ty / 220) * 100}%` }}
          role="status"
        >
          <b>{tip.label}</b>
          <span className="tip-row">
            <i className="swatch rc" />
            <span className="tip-name">{labels.player}</span>
            <b>{tip.playerText}</b>
          </span>
          {tip.relation ? <span className="tip-line tip-scale">{tip.relation}</span> : null}
          <span className="tip-row">
            <i className="swatch rt" />
            <span className="tip-name">{labels.avg}</span>
            <b>{tip.avgText}</b>
          </span>
          <span className="tip-line tip-scale">{tip.scale}</span>
        </div>
      ) : null}
      <div className="radar-legend legend">
        <span>
          <i className="swatch line rt" /> {labels.avg}
        </span>
        {hasPlayer ? (
          <span>
            <i className="swatch line rc" /> {labels.player}
          </span>
        ) : null}
      </div>
      {notes.map((n) => (
        <div key={n} className="radar-note muted">
          {n}
        </div>
      ))}
    </div>
  );
}
