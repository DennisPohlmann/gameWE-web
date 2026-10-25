import { useId } from "react";
import type { Heatmap } from "@/lib/heatmap";

// Kill and death positions as dots, like gameME's map tracking: deaths red,
// kills blue, headshots blue with a white centre, drawn in that order so
// headshots stay on top. Every kind is one path of zero-length round-capped
// segments, drawn twice (dark edge, then colour); the strokes do not scale,
// so a dot stays about 6px on every screen. North (higher y in the game) is
// up.

export type HeatShow = "all" | "killer" | "victim";

function path(dots: [number, number, ...number[]][]) {
  return dots.map(([x, y]) => `M${x} ${-y}h0`).join("");
}

export function HeatmapView({
  heat,
  show,
  label,
  title,
  labels,
}: {
  heat: Heatmap;
  show: HeatShow;
  label: string;
  title: string;
  labels: { kills: string; headshots: string; deaths: string };
}) {
  const id = useId().replace(/:/g, "");
  const { minX, minY, width, height } = heat;
  const pad = Math.max(width, height) * 0.03;
  const kills = show !== "victim";
  const deaths = show !== "killer";
  const layers: [string, string, [number, number, ...number[]][]][] = [];
  if (deaths) layers.push(["death", `${id}d`, heat.deathDots]);
  if (kills) {
    layers.push(["kill", `${id}k`, heat.killDots.filter((d) => !d[2])]);
    layers.push(["hs", `${id}h`, heat.killDots.filter((d) => d[2])]);
  }
  return (
    <div className="heatmap">
      <div className="heat-legend">
        <span className="heat-keys">
          {kills ? (
            <span>
              <i className="heat-key kill" aria-hidden="true" /> {labels.kills}
            </span>
          ) : null}
          {kills ? (
            <span>
              <i className="heat-key hs" aria-hidden="true" /> {labels.headshots}
            </span>
          ) : null}
          {deaths ? (
            <span>
              <i className="heat-key death" aria-hidden="true" /> {labels.deaths}
            </span>
          ) : null}
        </span>
        <span className="heat-title">{title}</span>
      </div>
      <svg viewBox={`${minX - pad} ${-(minY + height) - pad} ${width + 2 * pad} ${height + 2 * pad}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <defs>
          {layers.map(([, key, dots]) => (
            <path key={key} id={key} d={path(dots)} vectorEffect="non-scaling-stroke" />
          ))}
        </defs>
        <g className="heat-dots" fill="none" strokeLinecap="round">
          {layers.map(([kind, key]) => (
            <g key={key} className={kind}>
              <use href={`#${key}`} className="edge" />
              <use href={`#${key}`} className="dot" />
              {kind === "hs" ? <use href={`#${key}`} className="core" /> : null}
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}
