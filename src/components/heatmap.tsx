import type { Heatmap } from "@/lib/heatmap";
import { HoverTip } from "./hover-tip";

// Kill heatmap as SVG: one sharp square per grid cell, coloured from blue
// (few kills) over green and yellow to red (most). The scale is logarithmic
// so quiet corners stay visible next to the hot spots. North (higher y in
// the game) is up.

const STOPS: [number, [number, number, number]][] = [
  [0, [40, 70, 200]],
  [0.35, [40, 190, 120]],
  [0.65, [240, 220, 40]],
  [1, [230, 40, 30]],
];

function color(v: number) {
  for (let i = 1; i < STOPS.length; i++) {
    const [b, cb] = STOPS[i];
    const [a, ca] = STOPS[i - 1];
    if (v <= b) {
      const f = (v - a) / (b - a || 1);
      return `rgb(${ca.map((c, k) => Math.round(c + (cb[k] - c) * f)).join(",")})`;
    }
  }
  return "rgb(230,40,30)";
}

export function HeatmapView({ heat, label, tip }: { heat: Heatmap; label: string; tip: (n: number) => string }) {
  const { cols, rows, max } = heat;
  const log = Math.log1p(max) || 1;
  return (
    <HoverTip className="heatmap">
      <svg viewBox={`0 0 ${cols} ${rows}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <rect width={cols} height={rows} className="heat-bg" />
        <g className="heat-cells" shapeRendering="crispEdges">
          {heat.cells.map(([c, r, n]) => {
            const v = Math.log1p(n) / log;
            return <rect key={`${c}-${r}`} x={c} y={rows - 1 - r} width={1} height={1} fill={color(v)} opacity={0.45 + 0.55 * v} data-tip={tip(n)} />;
          })}
        </g>
      </svg>
      <div className="heat-legend" aria-hidden="true">
        <span>1</span>
        <i style={{ background: `linear-gradient(90deg, ${STOPS.map(([s]) => `${color(s)} ${s * 100}%`).join(", ")})` }} />
        <span>{max}</span>
      </div>
    </HoverTip>
  );
}
