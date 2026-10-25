import type { ReactNode } from "react";

// Row above a chart, the same on every chart: its title (or a short summary
// in normal text) on the left, the legend of its series on the right. Each
// entry is a short line with a dot, coloured like its series, for line and
// bar charts alike.

export type LegendEntry = { label: string; className: string };

export function ChartHead({ title, note, series, className }: { title?: string; note?: ReactNode; series: LegendEntry[]; className?: string }) {
  return (
    <figcaption className={className ? `chart-head ${className}` : "chart-head"}>
      {title ? <span className="chart-title">{title}</span> : null}
      {note ? <span className="chart-note">{note}</span> : null}
      {series.length ? (
        <span className="legend">
          {series.map((s) => (
            <span key={s.label}>
              <i className={`swatch line ${s.className}`} /> {s.label}
            </span>
          ))}
        </span>
      ) : null}
    </figcaption>
  );
}
