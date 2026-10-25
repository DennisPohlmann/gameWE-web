"use client";

import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from "react";
import { ChartHead } from "./chart-head";

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
  legend = false,
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
  // A heading above the chart, left of the legend (the legend alone, on
  // the right, without a title; none with a single untitled line).
  title?: string;
  // Show the legend even for a single untitled line (e.g. the site load).
  legend?: boolean;
}) {
  const { hover, setHover, svgRef, figRef, tipRef } = useHoverBox();
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
  const { min, max, ticks, tickText, left } = yScale(series.flatMap((s) => s.values), fromZero, locale, alignTo);
  const pad = { top: 12, right: 24, bottom: dates ? 36 : 22, left };
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
  // One point per day (no hours, no date row): dated days with a day line.
  const daily = !dates && !hourly && !sparseLabels ? new Set(dayMarks(n, gap)) : null;
  const showLabel = (l: string, i: number) =>
    hourly ? hourStride !== undefined && l !== "" && Number.parseInt(l, 10) % hourStride === 0 : sparseLabels ? l !== "" : daily ? daily.has(i) : i % every === 0 || i === n - 1;

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
      {title || legend || series.length > 1 ? <ChartHead title={title} series={series} /> : null}
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
        {daily ? [...daily].map((i) => (i > 0 ? <line key={`dl${i}`} className="day-line" x1={x(i)} x2={x(i)} y1={pad.top} y2={height - pad.bottom} /> : null)) : null}
        {labels.map((l, i) =>
          showLabel(l, i) ? (
            <text key={i} className={daily ? "axis day" : "axis"} x={x(i)} y={height - (dates ? 20 : 6)} textAnchor={daily && i === 0 ? "start" : daily && i === n - 1 ? "end" : "middle"}>
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
        <ChartTip tipRef={tipRef} top={hover.top} head={tips?.[hover.i] || labels[hover.i]} series={shown} i={hover.i} locale={locale} />
      ) : null}
    </figure>
  );
}

// Bar chart with a group of bars per label (e.g. kills and headshots per
// day), with the same axis, margins, title row and hover box as LineChart.
export function BarChart({
  labels,
  series,
  height = 160,
  width = 1000,
  ariaLabel,
  locale,
  alignTo,
  title,
}: {
  labels: string[];
  series: { label: string; values: number[]; className: string }[];
  height?: number;
  width?: number;
  ariaLabel: string;
  locale?: string;
  alignTo?: number;
  title?: string;
}) {
  const { hover, setHover, svgRef, figRef, tipRef } = useHoverBox();
  const n = labels.length;
  if (!n) return null;
  const { min, max, ticks, tickText, left } = yScale(series.flatMap((s) => s.values), true, locale, alignTo);
  const pad = { top: 12, right: 24, bottom: 22, left };
  const plotW = width - pad.left - pad.right;
  const slot = plotW / n;
  // Bars of a group side by side in the middle 70 % of their slot.
  const barW = (slot * 0.7) / Math.max(1, series.length);
  const cx = (i: number) => pad.left + (i + 0.5) * slot;
  const y = (v: number) => pad.top + (1 - (v - min) / (max - min || 1)) * (height - pad.top - pad.bottom);
  const base = y(min);
  // Dated days, each with a day line at its start.
  const marks = new Set(dayMarks(n, slot));

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    const fig = figRef.current;
    if (!svg || !fig) return;
    const r = svg.getBoundingClientRect();
    const f = fig.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * width;
    const i = Math.max(0, Math.min(n - 1, Math.floor((sx - pad.left) / slot)));
    const left = r.left - f.left + (cx(i) / width) * r.width;
    const top = r.top - f.top + (y(Math.max(...series.map((s) => s.values[i]))) / height) * r.height;
    setHover({ i, left, top, flip: left > f.width / 2 });
  };

  return (
    <figure className="chart" ref={figRef}>
      {title || series.length > 1 ? <ChartHead title={title} series={series} /> : null}
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line className="grid" x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} />
            <text className="axis" x={pad.left - 6} y={y(t) + 4} textAnchor="end">
              {tickText(t)}
            </text>
          </g>
        ))}
        {hover ? <rect className="bar-hover" x={pad.left + hover.i * slot} y={pad.top} width={slot} height={base - pad.top} /> : null}
        {labels.map((l, i) => (
          <g key={i}>
            {series.map((s, k) => (
              <rect
                key={s.label}
                className={`col ${s.className}`}
                x={cx(i) - (barW * series.length) / 2 + k * barW}
                y={y(s.values[i])}
                width={Math.max(1, barW - 1)}
                height={base - y(s.values[i])}
              />
            ))}
            {marks.has(i) ? (
              <>
                {i > 0 ? <line className="day-line" x1={pad.left + i * slot} x2={pad.left + i * slot} y1={pad.top} y2={base} /> : null}
                <text className="axis day" x={cx(i)} y={height - 6} textAnchor="middle">
                  {l}
                </text>
              </>
            ) : null}
          </g>
        ))}
        <rect
          className="hover-area"
          x={pad.left}
          y={0}
          width={plotW}
          height={height}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover ? <ChartTip tipRef={tipRef} top={hover.top} head={labels[hover.i]} series={series} i={hover.i} locale={locale} /> : null}
    </figure>
  );
}

// One line on the left axis and bars of its change on the right axis, per
// day (the player trend: points, and points gained or lost that day). Bars
// above zero take the "up" colour, below zero the "down" colour; both axes
// carry a title on top. Hover box and title row as in the other charts.
export function ComboChart({
  labels,
  tips,
  line,
  bars,
  axisTitles,
  height = 220,
  width = 640,
  ariaLabel,
  locale,
}: {
  labels: string[];
  // Day of each point for the hover box; defaults to the label.
  tips?: string[];
  line: { label: string; values: number[]; className: string };
  bars: { values: number[]; up: Named; down: Named };
  axisTitles: { left: string; right: string };
  height?: number;
  width?: number;
  ariaLabel: string;
  locale?: string;
}) {
  const { hover, setHover, svgRef, figRef, tipRef } = useHoverBox();
  const n = labels.length;
  if (!n) return null;
  const L = yScale(line.values, false, locale, undefined);
  const R = yScale(bars.values, true, locale, undefined);
  const signed = (t: number) => (t > 0 ? `+${R.tickText(t)}` : R.tickText(t));
  const right = Math.max(40, Math.ceil(12 + Math.max(...R.ticks.map((t) => signed(t).length)) * 6.5));
  const pad = { top: 24, right, bottom: 22, left: L.left };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const slot = plotW / n;
  const cx = (i: number) => pad.left + (i + 0.5) * slot;
  const yL = (v: number) => pad.top + (1 - (v - L.min) / (L.max - L.min || 1)) * plotH;
  const yR = (v: number) => pad.top + (1 - (v - R.min) / (R.max - R.min || 1)) * plotH;
  const zero = yR(0);
  const barW = Math.max(1, slot * 0.6);
  const dotR = Math.max(1, Math.min(2.5, slot / 3));
  // Dated days, each with a day line at its start.
  const marks = dayMarks(n, slot);

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const svg = svgRef.current;
    const fig = figRef.current;
    if (!svg || !fig) return;
    const r = svg.getBoundingClientRect();
    const f = fig.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * width;
    const i = Math.max(0, Math.min(n - 1, Math.floor((sx - pad.left) / slot)));
    const left = r.left - f.left + (cx(i) / width) * r.width;
    const top = r.top - f.top + (Math.min(yL(line.values[i]), yR(Math.max(0, bars.values[i]))) / height) * r.height;
    setHover({ i, left, top, flip: left > f.width / 2 });
  };

  const change = hover ? bars.values[hover.i] : 0;
  const tipSeries = hover
    ? [line, { ...(change >= 0 ? bars.up : bars.down), values: bars.values.map((v) => Math.abs(v)) }]
    : [];
  return (
    <figure className="chart combo" ref={figRef}>
      <ChartHead series={[line, ...(bars.values.some((v) => v > 0) ? [bars.up] : []), ...(bars.values.some((v) => v < 0) ? [bars.down] : [])]} />
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel}>
        <text className="axis title" x={4} y={12} textAnchor="start">
          {axisTitles.left}
        </text>
        <text className="axis title" x={width - 4} y={12} textAnchor="end">
          {axisTitles.right}
        </text>
        {L.ticks.map((t, i) => (
          <g key={`l${i}`}>
            <line className="grid" x1={pad.left} x2={width - pad.right} y1={yL(t)} y2={yL(t)} />
            <text className="axis" x={pad.left - 6} y={yL(t) + 4} textAnchor="end">
              {L.tickText(t)}
            </text>
          </g>
        ))}
        {R.ticks.map((t, i) => (
          <text key={`r${i}`} className="axis" x={width - pad.right + 6} y={yR(t) + 4} textAnchor="start">
            {signed(t)}
          </text>
        ))}
        {hover ? <rect className="bar-hover" x={pad.left + hover.i * slot} y={pad.top} width={slot} height={plotH} /> : null}
        {bars.values.map((v, i) =>
          v === 0 ? null : (
            <rect
              key={`b${i}`}
              className={`col ${v > 0 ? bars.up.className : bars.down.className}`}
              x={cx(i) - barW / 2}
              y={Math.min(zero, yR(v))}
              width={barW}
              height={Math.max(1, Math.abs(yR(v) - zero))}
            />
          ),
        )}
        <line className="zero" x1={pad.left} x2={width - pad.right} y1={zero} y2={zero} />
        {marks.map((i) => (
          <g key={`x${i}`}>
            {i > 0 ? <line className="day-line" x1={pad.left + i * slot} x2={pad.left + i * slot} y1={pad.top} y2={height - pad.bottom} /> : null}
            <text className="axis day" x={cx(i)} y={height - 6} textAnchor="middle">
              {labels[i]}
            </text>
          </g>
        ))}
        {n > 1 ? <polyline className={`line ${line.className}`} points={line.values.map((v, i) => `${cx(i).toFixed(1)},${yL(v).toFixed(1)}`).join(" ")} /> : null}
        {line.values.map((v, i) => (
          <circle key={`d${i}`} className={`dot small ${line.className}`} cx={cx(i)} cy={yL(v)} r={n > 1 ? dotR : 4} />
        ))}
        {hover ? <circle className={`dot hot ${line.className}`} cx={cx(hover.i)} cy={yL(line.values[hover.i])} r={5} /> : null}
        <rect
          className="hover-area"
          x={pad.left}
          y={0}
          width={plotW}
          height={height}
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover ? <ChartTip tipRef={tipRef} top={hover.top} head={tips?.[hover.i] || labels[hover.i]} series={tipSeries} i={hover.i} locale={locale} /> : null}
    </figure>
  );
}

// State of the hover box. It sits beside the guide line, flipped to its left
// on the right half, and is pushed back inside the chart where it would
// stick out.
function useHoverBox() {
  const [hover, setHover] = useState<{ i: number; left: number; top: number; flip: boolean } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const figRef = useRef<HTMLElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const tip = tipRef.current;
    const fig = figRef.current;
    if (!hover || !tip || !fig) return;
    const w = tip.offsetWidth;
    const want = hover.flip ? hover.left - 12 - w : hover.left + 12;
    tip.style.left = `${Math.max(0, Math.min(fig.clientWidth - w, want))}px`;
  }, [hover]);
  return { hover, setHover, svgRef, figRef, tipRef };
}

// Value axis: ticks at round whole numbers (1, 2, 2.5 or 5 times a power of
// ten), about four steps from bottom to top; counts never go below 0. The
// left margin is as wide as the longest tick label (about 6.5 units per
// character at the axis font size), at least 40.
function yScale(values: (number | null)[], fromZero: boolean, locale: string | undefined, alignTo: number | undefined) {
  const all = values.filter((v): v is number => v !== null);
  const lowest = all.length ? Math.min(...all) : 0;
  const lo = fromZero ? Math.min(0, ...all) : lowest - (Math.max(lowest + 2, ...all) - lowest) * 0.05;
  const hi = Math.max(fromZero ? 2 : lowest + 2, ...all);
  const step = niceStep((hi - lo) / 4);
  const min = lowest >= 0 ? Math.max(0, Math.floor(lo / step) * step) : Math.floor(lo / step) * step;
  const max = Math.ceil(hi / step) * step;
  const ticks = Array.from({ length: Math.round((max - min) / step) + 1 }, (_, i) => min + i * step);
  const tickText = (t: number) => t.toLocaleString(locale);
  const longest = Math.max(...ticks.map((t) => tickText(t).length), alignTo === undefined ? 0 : tickText(Math.ceil(alignTo)).length);
  return { min, max, ticks, tickText, left: Math.max(40, Math.ceil(12 + longest * 6.5)) };
}

type Named = { label: string; className: string };

// Hover box: the time or day, then one row per series: colour, name
// (shortened when too long), value right-aligned in its own column. All
// charts show counts; players online are averages per time slot, so the
// values are rounded.
function ChartTip({
  tipRef,
  top,
  head,
  series,
  i,
  locale,
}: {
  tipRef: RefObject<HTMLDivElement | null>;
  top: number;
  head: string;
  series: (Named & { values: (number | null)[] })[];
  i: number;
  locale?: string;
}) {
  return (
    <div ref={tipRef} className="chart-tip" style={{ top }} role="status">
      <b>{head}</b>
      {series.map((s) => (
        <span key={s.label} className="tip-row">
          <i className={`swatch ${s.className}`} />
          <span className="tip-name">{s.label}</span>
          <b>{Math.round(s.values[i]!).toLocaleString(locale)}</b>
        </span>
      ))}
    </div>
  );
}

// Days of a daily chart that get their date and a dashed day line: every
// 1, 2, 3, 7 or 14 days (whatever leaves a date about 56 units of room),
// counted back from the last day, so today always has its date. unit: the
// room per day.
function dayMarks(n: number, unit: number): number[] {
  const stride = [1, 2, 3, 7, 14].find((d) => d * unit >= 56) ?? Math.ceil(56 / Math.max(1, unit));
  return Array.from({ length: n }, (_, i) => i).filter((i) => (n - 1 - i) % stride === 0);
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
