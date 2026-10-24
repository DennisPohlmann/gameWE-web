import type { ReactNode } from "react";
import { HoverTip } from "./hover-tip";

// Server-rendered SVG graphics of the player profile: radar, spark pills and
// the player trend. Hovering shows the values (HoverTip box, data-tip).

export type RadarAxis = { label: string; total: number; current: number; text: string };

// Pentagon (or n-gon) chart: grey = all time, orange = last two weeks.
// Values are 0..1.
export function Radar({ axes, labels }: { axes: RadarAxis[]; labels: { total: string; current: string } }) {
  const n = axes.length;
  const c = 110;
  const r = 70;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const k = Math.max(0.03, Math.min(1, v)) * r;
    return [c + k * Math.cos(a), c + k * Math.sin(a)];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).map((x) => x.toFixed(1)).join(",")).join(" ");
  return (
    <svg className="radar" viewBox="0 0 220 220" role="img" aria-label={axes.map((a) => `${a.label} ${a.text}`).join(", ")}>
      {[0.25, 0.5, 0.75, 1].map((g) => (
        <polygon key={g} className="radar-grid" points={poly(axes.map(() => g))} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, 1);
        return <line key={i} className="radar-grid" x1={c} y1={c} x2={x} y2={y} />;
      })}
      <polygon className="radar-total" points={poly(axes.map((a) => a.total))}>
        <title>{labels.total}</title>
      </polygon>
      <polygon className="radar-current" points={poly(axes.map((a) => a.current))}>
        <title>{labels.current}</title>
      </polygon>
      {axes.map((a, i) => {
        const [x, y] = pt(i, 1.28);
        return (
          <text key={a.label} className="radar-label" x={x} y={y + 3} textAnchor={x < c - 5 ? "end" : x > c + 5 ? "start" : "middle"}>
            <title>{a.text}</title>
            {a.label}
          </text>
        );
      })}
    </svg>
  );
}

// gameME's value pill: total | current | sparkline | min | max.
export function Spark({
  values,
  total,
  current,
  min,
  max,
  titles,
}: {
  values: number[];
  total: string;
  current: string;
  min: string;
  max: string;
  titles: { total: string; current: string; min: string; max: string };
}) {
  if (!values.length) return <b className="spark-plain">{total}</b>;
  const w = 80;
  const h = 16;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pts =
    values.length > 1
      ? values.map((v, i) => `${((i * w) / (values.length - 1)).toFixed(1)},${(h - 2 - ((v - lo) / (hi - lo || 1)) * (h - 4)).toFixed(1)}`).join(" ")
      : "";
  return (
    <span className="spark">
      <b className="sp-total" title={titles.total}>
        {total}
      </b>
      <b className="sp-current" title={titles.current}>
        {current}
      </b>
      {pts ? (
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
          <polyline points={pts} />
        </svg>
      ) : null}
      <b className="sp-min" title={titles.min}>
        {min}
      </b>
      <b className="sp-max" title={titles.max}>
        {max}
      </b>
    </span>
  );
}

// Points per day as a line, the day's gain or loss as bars below.
export function TrendChart({
  days,
  locale,
  labels,
}: {
  days: { day: string; skill: number; change: number }[];
  locale: string;
  labels: { points: string; gained: string; lost: string };
}) {
  const W = 640;
  const H = 260;
  const pad = { l: 52, r: 10, t: 10 };
  const lineH = 150;
  const barTop = 175;
  const barH = 60;
  const n = days.length;
  if (n < 1) return null;
  const lo = Math.min(...days.map((d) => d.skill));
  const hi = Math.max(...days.map((d) => d.skill));
  const span = hi - lo || 1;
  const x = (i: number) => pad.l + ((i + 0.5) * (W - pad.l - pad.r)) / n;
  const y = (v: number) => pad.t + (1 - (v - lo) / span) * (lineH - pad.t);
  const maxAbs = Math.max(1, ...days.map((d) => Math.abs(d.change)));
  const mid = barTop + barH / 2;
  const bw = Math.max(2, ((W - pad.l - pad.r) / n) * 0.6);
  const fmt = (v: number) => Math.round(v).toLocaleString(locale);
  const every = Math.max(1, Math.ceil(n / 8));
  return (
    <HoverTip>
      <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.points}>
        {[lo, (lo + hi) / 2, hi].map((v, i) => (
          <g key={i}>
            <line className="grid" x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} />
            <text className="axis" x={pad.l - 5} y={y(v) + 3} textAnchor="end">
              {fmt(v)}
            </text>
          </g>
        ))}
        <line className="grid" x1={pad.l} x2={W - pad.r} y1={mid} y2={mid} />
        <text className="axis" x={pad.l - 5} y={barTop + 6} textAnchor="end">
          +{fmt(maxAbs)}
        </text>
        <text className="axis" x={pad.l - 5} y={barTop + barH} textAnchor="end">
          -{fmt(maxAbs)}
        </text>
        <polyline className="trend-line" points={days.map((d, i) => `${x(i).toFixed(1)},${y(d.skill).toFixed(1)}`).join(" ")} />
        {days.map((d, i) => {
          const h = (Math.abs(d.change) / maxAbs) * (barH / 2);
          return (
            <g
              key={d.day}
              className="trend-day"
              data-tip={`${d.day.slice(8, 10)}.${d.day.slice(5, 7)}.${d.day.slice(0, 4)}\n${labels.points}: ${fmt(d.skill)}\n${d.change >= 0 ? labels.gained : labels.lost}: ${fmt(Math.abs(d.change))}`}
            >
              <rect className="hover" x={x(i) - bw / 2 - 1} y={pad.t} width={bw + 2} height={barTop + barH - pad.t} />
              <circle className="trend-dot" cx={x(i)} cy={y(d.skill)} r="2.5" />
              <rect className={d.change >= 0 ? "bar-up" : "bar-down"} x={x(i) - bw / 2} y={d.change >= 0 ? mid - h : mid} width={bw} height={Math.max(1, h)} />
              {i % every === 0 || i === n - 1 ? (
                <text className="axis" x={x(i)} y={H - 4} textAnchor="middle">
                  {d.day.slice(8, 10)}.{d.day.slice(5, 7)}.
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </HoverTip>
  );
}

const PIE_COLORS = ["#ff8000", "#3b8fd9", "#4caf50", "#d64545", "#a35ad8", "#e6c229", "#2fb5a8", "#d87aa0", "#8a8a8a"];

// Pie with a legend; hovering a slice shows its label and share.
export function Pie({ slices, locale }: { slices: { label: string; value: number; icon?: ReactNode }[]; locale: string }) {
  const total = slices.reduce((n, s) => n + s.value, 0);
  if (!total) return null;
  const c = 90;
  const r = 80;
  let a0 = -Math.PI / 2;
  const pct = (v: number) => `${((v / total) * 100).toLocaleString(locale, { maximumFractionDigits: 1 })} %`;
  return (
    <HoverTip className="pie">
      <svg viewBox="0 0 180 180" width="180" height="180" role="img" aria-label={slices.map((s) => `${s.label} ${pct(s.value)}`).join(", ")}>
        {slices.map((s, i) => {
          const a1 = a0 + (s.value / total) * Math.PI * 2;
          const color = PIE_COLORS[i % PIE_COLORS.length];
          const path =
            s.value === total
              ? null
              : `M${c},${c} L${(c + r * Math.cos(a0)).toFixed(2)},${(c + r * Math.sin(a0)).toFixed(2)} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(c + r * Math.cos(a1)).toFixed(2)},${(c + r * Math.sin(a1)).toFixed(2)} Z`;
          a0 = a1;
          return path ? (
            <path key={i} d={path} fill={color} className="slice" data-tip={`${s.label}\n${pct(s.value)} · ${s.value.toLocaleString(locale)}`} />
          ) : (
            <circle key={i} cx={c} cy={c} r={r} fill={color} className="slice" data-tip={`${s.label}\n${pct(s.value)} · ${s.value.toLocaleString(locale)}`} />
          );
        })}
      </svg>
      <ul className="pie-legend">
        {slices.map((s, i) => (
          <li key={i}>
            <i className="swatch" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            {s.icon} {s.label} <span className="muted">{pct(s.value)}</span>
          </li>
        ))}
      </ul>
    </HoverTip>
  );
}

// Seven pairs of bars (Monday first): connects and play time per weekday.
export function WeekdayBars({
  days,
  labels,
  locale,
}: {
  days: { connects: number; seconds: number }[];
  labels: { days: string[]; connects: string; time: string };
  locale: string;
}) {
  const W = 460;
  const H = 200;
  const base = 170;
  const maxC = Math.max(1, ...days.map((d) => d.connects));
  const maxS = Math.max(1, ...days.map((d) => d.seconds));
  const slot = (W - 20) / 7;
  const fmtH = (s: number) =>
    `${Math.floor(s / 86400)}d ${String(Math.floor((s % 86400) / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}h`;
  return (
    <figure className="chart">
      <HoverTip>
        <svg className="weekday" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${labels.connects}, ${labels.time}`}>
          <line className="grid" x1="10" x2={W - 10} y1={base} y2={base} />
          {days.map((d, i) => {
            const x = 10 + i * slot + slot * 0.15;
            const bw = slot * 0.33;
            const hc = (d.connects / maxC) * (base - 15);
            const hs = (d.seconds / maxS) * (base - 15);
            return (
              <g
                key={i}
                className="bar-day"
                data-tip={`${labels.days[i]}\n${labels.connects}: ${d.connects.toLocaleString(locale)}\n${labels.time}: ${fmtH(d.seconds)}`}
              >
                <rect className="hover" x={10 + i * slot} y={10} width={slot} height={base - 10} />
                <rect className="bar-s1" x={x} y={base - hc} width={bw} height={hc} />
                <rect className="bar-s2" x={x + bw + 2} y={base - hs} width={bw} height={hs} />
                <text className="axis" x={x + bw + 1} y={H - 12} textAnchor="middle">
                  {labels.days[i]}
                </text>
              </g>
            );
          })}
        </svg>
      </HoverTip>
      <figcaption className="legend">
        <span>
          <i className="swatch s1" /> {labels.connects}
        </span>
        <span>
          <i className="swatch s2" /> {labels.time}
        </span>
      </figcaption>
    </figure>
  );
}

// Server load of the last day: players (left axis) and uptime (right axis),
// with one band per map that was played.
export function ServerLoadChart({
  points,
  slots,
  locale,
  labels,
}: {
  points: { timestamp: number; act_players: number; min_players: number; max_players: number; uptime: number; map: string | null }[];
  slots: number;
  locale: string;
  labels: { players: string; uptime: string };
}) {
  const W = 960;
  const H = 280;
  const pad = { l: 40, r: 46, t: 10, b: 36 };
  const n = points.length;
  if (n < 2) return null;
  const t0 = points[0].timestamp;
  const t1 = points[n - 1].timestamp;
  const span = Math.max(1, t1 - t0);
  const x = (ts: number) => pad.l + ((ts - t0) / span) * (W - pad.l - pad.r);
  const maxP = Math.max(1, slots, ...points.map((p) => p.max_players));
  const yP = (v: number) => pad.t + (1 - v / maxP) * (H - pad.t - pad.b);
  const maxU = Math.max(1, ...points.map((p) => p.uptime)) / 60;
  const yU = (h: number) => pad.t + (1 - h / maxU) * (H - pad.t - pad.b);
  const hhmm = (ts: number) => new Date(ts * 1000).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  const upText = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}h`;

  // Consecutive points with the same map form one band.
  const bands: { from: number; to: number; map: string }[] = [];
  for (let i = 0; i < n; i++) {
    const map = points[i].map ?? "";
    const end = i + 1 < n ? points[i + 1].timestamp : points[i].timestamp;
    const last = bands[bands.length - 1];
    if (last && last.map === map) last.to = end;
    else bands.push({ from: points[i].timestamp, to: end, map });
  }
  const pTicks = [0, Math.round(maxP / 2), maxP];
  const uTicks = [0, maxU / 2, maxU];
  const hourStep = span > 12 * 3600 ? 7200 : 3600;
  const hours: number[] = [];
  for (let h = Math.ceil(t0 / hourStep) * hourStep; h <= t1; h += hourStep) hours.push(h);
  // Local midnights: a line with the new day's date below; the first day's
  // date sits at the left edge.
  const ddmm = (ts: number) => new Date(ts * 1000).toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" });
  const midnights: number[] = [];
  for (const d = new Date(t0 * 1000); ; ) {
    d.setHours(24, 0, 0, 0);
    const ts = d.getTime() / 1000;
    if (ts > t1) break;
    midnights.push(ts);
  }
  const dateY = H - pad.b + 28;

  return (
    <figure className="chart load-chart">
      <HoverTip>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={labels.players}>
          {bands.map((b, i) => {
            const bx = x(b.from);
            const bw = Math.max(1, x(b.to) - bx);
            return (
              <g key={i}>
                <rect className={i % 2 ? "band odd" : "band"} x={bx} y={pad.t} width={bw} height={H - pad.t - pad.b} />
                {bw >= 9 && b.map ? (
                  // Map name at the left edge of its band, reading upwards from the bottom.
                  <text className="band-label" transform={`translate(${bx + 10},${H - pad.b - 4}) rotate(-90)`}>
                    {b.map.length > 26 ? `${b.map.slice(0, 25)}…` : b.map}
                  </text>
                ) : null}
              </g>
            );
          })}
          {pTicks.map((v) => (
            <g key={`p${v}`}>
              <line className="grid" x1={pad.l} x2={W - pad.r} y1={yP(v)} y2={yP(v)} />
              <text className="axis" x={pad.l - 5} y={yP(v) + 3} textAnchor="end">
                {v}
              </text>
            </g>
          ))}
          {uTicks.map((v, i) => (
            <text key={`u${i}`} className="axis up" x={W - pad.r + 5} y={yU(v) + 3}>
              {Math.round(v)}h
            </text>
          ))}
          {hours.map((h) => (
            <text key={h} className="axis" x={x(h)} y={H - pad.b + 14} textAnchor="middle">
              {hhmm(h)}
            </text>
          ))}
          {midnights.map((m) => (
            <g key={`d${m}`}>
              <line className="day-line" x1={x(m)} x2={x(m)} y1={pad.t} y2={H - pad.b} />
              <text className="axis day" x={x(m)} y={dateY} textAnchor="middle">
                {ddmm(m)}
              </text>
            </g>
          ))}
          {!midnights.length || x(midnights[0]) - pad.l > 90 ? (
            <text className="axis day" x={pad.l} y={dateY} textAnchor="start">
              {ddmm(t0)}
            </text>
          ) : null}
          <polyline className="line-up" points={points.map((p) => `${x(p.timestamp).toFixed(1)},${yU(p.uptime / 60).toFixed(1)}`).join(" ")} />
          <polyline className="line-players" points={points.map((p) => `${x(p.timestamp).toFixed(1)},${yP(p.act_players).toFixed(1)}`).join(" ")} />
          {/* A small dot at every sample, like on the graph of all servers. */}
          {points.map((p, i) => (
            <g key={`s${i}`} className="load-mark">
              <circle className="up" cx={x(p.timestamp)} cy={yU(p.uptime / 60)} r="2" />
              <circle cx={x(p.timestamp)} cy={yP(p.act_players)} r="2.5" />
            </g>
          ))}
          {points.map((p, i) => {
            // Each point owns the strip up to half way to its neighbours.
            const cx = x(p.timestamp);
            const from = i ? (x(points[i - 1].timestamp) + cx) / 2 : pad.l;
            const to = i < n - 1 ? (cx + x(points[i + 1].timestamp)) / 2 : W - pad.r;
            return (
              <g
                key={i}
                className="load-pt"
                data-tip={`${hhmm(p.timestamp)} · ${p.map ?? "?"}\n${labels.players}: ${p.act_players} (${p.min_players}–${p.max_players})\n${labels.uptime}: ${upText(p.uptime)}`}
              >
                <rect className="hover" x={from} y={pad.t} width={Math.max(1, to - from)} height={H - pad.t - pad.b} />
                <line className="guide" x1={cx} x2={cx} y1={pad.t} y2={H - pad.b} />
                <circle className="load-dot" cx={cx} cy={yP(p.act_players)} r="4.5" />
                <circle className="load-dot up" cx={cx} cy={yU(p.uptime / 60)} r="3.5" />
              </g>
            );
          })}
        </svg>
      </HoverTip>
      <figcaption className="legend">
        <span>
          <i className="swatch s2" /> {labels.players}
        </span>
        <span>
          <i className="swatch up" /> {labels.uptime}
        </span>
      </figcaption>
    </figure>
  );
}
