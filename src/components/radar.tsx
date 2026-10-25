"use client";

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

// Profile radar: one axis per stat, the all-time polygon and the last two
// weeks on top. Hovering, tapping or focusing an axis (Tab, then the arrow
// keys) highlights it and shows its values and scale in a box. Colours come
// from the template's chart.json (radar.*), see globals.css.

export type RadarAxis = {
  label: string;
  total: number; // radius 0..1
  current: number | null;
  totalText: string; // "1.42"
  currentText: string;
  totalScale: string; // "better than 78 % of players" or "scale 0–3"
  currentScale: string;
};

const C = 110;
const R = 70;

export function Radar({ axes, labels, note }: { axes: RadarAxis[]; labels: { total: string; current: string }; note?: string }) {
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
    `${a.label}: ${labels.total} ${a.totalText}, ${a.totalScale}` + (a.current !== null ? `; ${labels.current} ${a.currentText}, ${a.currentScale}` : "");

  // Fewer than three axes make no polygon: the values as a list.
  if (n < 3) {
    return (
      <dl className="radar-list">
        {axes.map((a) => (
          <div key={a.label}>
            <dt>{a.label}</dt>
            <dd>
              {a.totalText}
              {a.current !== null ? <span className="muted"> ({a.currentText}*)</span> : null}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  const hasCurrent = axes.some((a) => a.current !== null);
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
  // Beside the vertex for side axes; above or below the label for the axis
  // at the top or bottom.
  const side = active === null ? "" : (([x]) => (x < C - 5 ? "left" : x > C + 5 ? "right" : ""))(pt(active, 1));
  const [tx, ty] = active === null ? [0, 0] : pt(active, side ? 1.05 : 1.42);
  const place = side || (ty < C ? "up" : "down");

  return (
    <div
      className="radar-wrap"
      // A finger leaves right after the tap: there the box stays until focus moves away.
      onPointerLeave={(e: PointerEvent) => e.pointerType !== "touch" && setActive(null)}
    >
      <svg className="radar" viewBox="0 0 220 220" role="group" aria-label={`${labels.total} / ${labels.current}`}>
        {[0.25, 0.5, 0.75, 1].map((g) => (
          <polygon key={g} className="radar-grid" points={poly(axes.map(() => g))} />
        ))}
        {axes.map((_, i) => {
          const [x, y] = pt(i, 1);
          return <line key={i} className={i === active ? "radar-grid on" : "radar-grid"} x1={C} y1={C} x2={x} y2={y} />;
        })}
        <polygon className="radar-total" points={poly(axes.map((a) => a.total))} />
        {hasCurrent ? <polygon className="radar-current" points={poly(axes.map((a) => a.current ?? 0))} /> : null}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.28);
          const [px, py] = pt(i, a.total);
          const cur = a.current === null ? null : pt(i, a.current);
          const on = i === active;
          return (
            <g
              key={a.label}
              className={on ? "radar-axis on" : "radar-axis"}
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
              <circle className="radar-dot total" cx={px} cy={py} r={on ? 4 : 2.5} />
              {cur ? <circle className="radar-dot current" cx={cur[0]} cy={cur[1]} r={on ? 4 : 2.5} /> : null}
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
            <i className="swatch rt" />
            <span className="tip-name">{labels.total}</span>
            <b>{tip.totalText}</b>
          </span>
          <span className="tip-line tip-scale">{tip.totalScale}</span>
          {tip.current !== null ? (
            <>
              <span className="tip-row">
                <i className="swatch rc" />
                <span className="tip-name">{labels.current}</span>
                <b>{tip.currentText}</b>
              </span>
              <span className="tip-line tip-scale">{tip.currentScale}</span>
            </>
          ) : null}
        </div>
      ) : null}
      <div className="radar-legend legend">
        <span>
          <i className="swatch line rt" /> {labels.total}
        </span>
        {hasCurrent ? (
          <span>
            <i className="swatch line rc" /> {labels.current}
          </span>
        ) : null}
      </div>
      {note ? <div className="radar-note muted">{note}</div> : null}
    </div>
  );
}
