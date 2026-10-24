"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";

// SVG line chart. Rendered on the server; in the browser, moving the mouse
// (or a finger) over it marks the nearest point in time and shows the
// values of all lines there.

// null leaves a gap, e.g. days before the first data.
type Series = { label: string; values: (number | null)[]; className: string };

export function LineChart({
  labels: allLabels,
  tips: allTips,
  series: allSeries,
  height = 160,
  width = 1000,
  ariaLabel,
  locale,
  sparseLabels = false,
  fromZero = true,
  dates: allDates,
  hourly = false,
  trimStart = true,
  trimBy,
  alignTo,
  title,
}: {
  labels: string[];
  // Time of each point for the hover box (e.g. "Mo 20.10. 14:00");
  // defaults to the label.
  tips?: string[];
  series: Series[];
  height?: number;
  // Narrower for half-width boxes, so the labels keep their size.
  width?: number;
  ariaLabel: string;
  locale?: string;
  // false: the scale starts near the smallest value (running totals).
  fromZero?: boolean;
  // Show every non-empty label (e.g. one per day on an hourly chart)
  // instead of about six evenly spaced ones, each with a day line.
  sparseLabels?: boolean;
  // The day of each point (e.g. "Do 23.10."): a line where the day changes,
  // with the date in a second row below the times.
  dates?: string[];
  // Labels are the hour of each point ("14:00"): only every 1, 2, 3, 6 or 12
  // hours, whatever fits, or none when even 12 hours are too narrow.
  hourly?: boolean;
  // false: always show the whole range, even when it begins with zeros
  // (e.g. connects per day, where a quiet day is a real 0).
  trimStart?: boolean;
  // Values that decide where the graph starts and ends instead of its own
  // lines, so charts stacked together (e.g. running totals below the
  // values per hour) cover the same time.
  trimBy?: (number | null)[][];
  // Largest value of the charts stacked together: the left margin fits its
  // label too, so they all keep the same left edge.
  alignTo?: number;
  // A heading above the chart with the legend of its lines beside it,
  // instead of the legend below (only with more than one line).
  title?: string;
}) {
  const [hover, setHover] = useState<{ i: number; left: number; top: number; flip: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const figRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  // The hover box sits beside the guide line, flipped to its left on the
  // right half, and is pushed back inside the chart where it would stick out.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const fig = figRef.current;
    if (!hover || !tip || !fig) return;
    const w = tip.offsetWidth;
    const want = hover.flip ? hover.left - 12 - w : hover.left + 12;
    tip.style.left = `${Math.max(0, Math.min(fig.clientWidth - w, want))}px`;
  }, [hover]);
  // While a graph is still filling up (e.g. load recorded since two days),
  // it starts at the first point with data instead of an empty left part.
  const trim = trimBy ?? allSeries.map((s) => s.values);
  const first = !trimStart ? 0 : Math.min(
    Math.max(0, allLabels.length - 2),
    Math.max(0, allLabels.findIndex((_, i) => trim.some((v) => (v[i] ?? 0) !== 0))),
  );
  // Hours not recorded yet at the end are left out too.
  let end = allLabels.length;
  while (end - first > 2 && trim.every((v) => v[end - 1] === null || v[end - 1] === undefined)) end--;
  const labels = allLabels.slice(first, end);
  const tips = allTips?.slice(first, end);
  const series = allSeries.map((s) => ({ ...s, values: s.values.slice(first, end) }));
  const dates = allDates?.slice(first, end);
  const n = labels.length;
  if (n < 2) return null;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const lowest = all.length ? Math.min(...all) : 0;
  const lo = fromZero ? Math.min(0, ...all) : lowest - (Math.max(lowest + 2, ...all) - lowest) * 0.05;
  const hi = Math.max(fromZero ? 2 : lowest + 2, ...all);
  // Ticks at round whole numbers (1, 2, 2.5 or 5 times a power of ten),
  // about four steps from bottom to top; counts never go below 0.
  const step = niceStep((hi - lo) / 4);
  const min = lowest >= 0 ? Math.max(0, Math.floor(lo / step) * step) : Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  // Left margin as wide as the longest tick label (about 6.5 units per
  // character at the axis font size), at least the old 40.
  const tickText = (t: number) => t.toLocaleString(locale);
  const longest = Math.max(...ticks.map((t) => tickText(t).length), alignTo === undefined ? 0 : tickText(Math.ceil(alignTo)).length);
  const pad = { top: 12, right: 24, bottom: dates ? 36 : 22, left: Math.max(40, Math.ceil(12 + longest * 6.5)) };
  const plotW = width - pad.left - pad.right;
  const x = (i: number) => pad.left + (i * plotW) / (n - 1);
  const gap = plotW / (n - 1);
  const dotR = Math.max(1, Math.min(2.5, gap / 3));
  const dense = gap < 6;
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const every = Math.max(1, Math.ceil(n / 6));
  // First point of each day; a date needs about 70 units of room.
  const dayStarts = dates ? dates.flatMap((d, i) => (i === 0 || d !== dates[i - 1] ? [i] : [])) : [];
  const dayWidth = dayStarts.length > 2 ? (x(dayStarts[dayStarts.length - 1]) - x(dayStarts[1])) / (dayStarts.length - 2) : plotW;
  const dateEvery = Math.max(1, Math.ceil(70 / Math.max(1, dayWidth)));
  const hourStride = hourly ? [1, 2, 3, 6, 12].find((h) => (h * plotW) / (n - 1) >= 30) : undefined;
  const showLabel = (l: string, i: number) =>
    hourly ? hourStride !== undefined && l !== "" && Number.parseInt(l, 10) % hourStride === 0 : sparseLabels ? l !== "" : i % every === 0 || i === n - 1;
  // All charts show counts (players, kills, headshots, connects); players
  // online are averages per time slot, so the hover box rounds them.
  const fmt = (v: number) => Math.round(v).toLocaleString(locale);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    const fig = figRef.current;
    if (!svg || !fig) return;
    const r = svg.getBoundingClientRect();
    const f = fig.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * width;
    const i = Math.max(0, Math.min(n - 1, Math.round(((sx - pad.left) / plotW) * (n - 1))));
    const left = r.left - f.left + (x(i) / width) * r.width;
    const vals = series.map((s) => s.values[i]).filter((v): v is number => v !== null);
    const top = r.top - f.top + ((vals.length ? y(Math.max(...vals)) : pad.top) / height) * r.height;
    setHover({ i, left, top, flip: left > f.width / 2 });
  };

  const shown = hover ? series.filter((s) => s.values[hover.i] !== null && s.values[hover.i] !== undefined) : [];
  return (
    <figure className="chart" ref={figRef}>
      {title ? (
        <figcaption className="chart-head">
          <span className="chart-title">{title}</span>
          <span className="legend">
            {series.map((s) => (
              <span key={s.label}>
                <i className={`swatch line ${s.className}`} /> {s.label}
              </span>
            ))}
          </span>
        </figcaption>
      ) : null}
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.left - 6} y={y(t) + 4} textAnchor="end">
              {tickText(t)}
            </text>
          </g>
        ))}
        {dayStarts.map((i, k) => (
          <g key={`day${i}`}>
            {i > 0 ? <line className="day-line" x1={x(i)} x2={x(i)} y1={pad.top} y2={height - pad.bottom} /> : null}
            {/* Every day's date as far as they fit; the first only when the next day is far enough away. */}
            {(i === 0 ? (dayStarts[1] === undefined || x(dayStarts[1]) - x(0) >= 90) : k % dateEvery === 0) ? (
              <text className="axis day" x={x(i)} y={height - 5} textAnchor={i === 0 ? "start" : "middle"}>
                {dates![i]}
              </text>
            ) : null}
          </g>
        ))}
        {/* Hourly charts: a line at the start of each labelled day. */}
        {sparseLabels
          ? labels.map((l, i) => (l !== "" && i > 0 ? <line key={`d${i}`} className="day-line" x1={x(i)} x2={x(i)} y1={pad.top} y2={height - pad.bottom} /> : null))
          : null}
        {labels.map((l, i) =>
          showLabel(l, i) ? (
            <text key={i} className="axis" x={x(i)} y={height - (dates ? 20 : 6)} textAnchor="middle">
              {l}
            </text>
          ) : null,
        )}
        {hover ? <line className="guide" x1={x(hover.i)} x2={x(hover.i)} y1={pad.top} y2={height - pad.bottom} /> : null}
        {series.map((s) =>
          runs(s.values).map((run) =>
            run.length > 1 ? (
              <polyline
                key={`${s.label}-${run[0]}`}
                className={`line ${s.className}`}
                points={run.map((i) => `${x(i).toFixed(1)},${y(s.values[i]!).toFixed(1)}`).join(" ")}
              />
            ) : (
              <circle key={`${s.label}-${run[0]}`} className={`dot ${s.className}`} cx={x(run[0])} cy={y(s.values[run[0]]!)} r={4} />
            ),
          ),
        )}
        {/* Every point gets a dot; on dense charts (14 days per quarter hour)
            they shrink to the room between two points and lose the white edge. */}
        {series.map((s) =>
          s.values.map((v, i) =>
            v === null ? null : <circle key={`${s.label}-d${i}`} className={`dot small${dense ? " dense" : ""} ${s.className}`} cx={x(i)} cy={y(v)} r={dotR} />,
          ),
        )}
        {hover
          ? shown.map((s) => <circle key={`${s.label}-h`} className={`dot hot ${s.className}`} cx={x(hover.i)} cy={y(s.values[hover.i]!)} r={5} />)
          : null}
        <rect
          className="hover-area"
          x={pad.left - 8}
          y={0}
          width={plotW + 16}
          height={height}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover && shown.length ? (
        <div ref={tipRef} className="chart-tip" style={{ top: hover.top }} role="status">
          <b>{tips?.[hover.i] || labels[hover.i]}</b>
          {/* One row per line: colour, name (shortened when too long), value
              right-aligned in its own column. */}
          {shown.map((s) => (
            <span key={s.label} className="tip-row">
              <i className={`swatch ${s.className}`} />
              <span className="tip-name">{s.label}</span>
              <b>{fmt(s.values[hover.i]!)}</b>
            </span>
          ))}
        </div>
      ) : null}
      {!title && series.length > 1 ? (
        <figcaption className="legend">
          {series.map((s) => (
            <span key={s.label}>
              <i className={`swatch ${s.className}`} /> {s.label}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}

// Smallest round whole number at least raw: 1, 2, 2.5 or 5 times a power of
// ten (2.5 only from 25 on, so it stays whole).
function niceStep(raw: number): number {
  if (raw <= 1) return 1;
  const p = 10 ** Math.floor(Math.log10(raw));
  const f = raw / p;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 && p >= 10 ? 2.5 : f <= 5 ? 5 : 10;
  return m * p;
}

// Index runs of consecutive non-null values.
function runs(values: (number | null)[]): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (cur.length) out.push(cur);
      cur = [];
    } else cur.push(i);
  });
  if (cur.length) out.push(cur);
  return out;
}
