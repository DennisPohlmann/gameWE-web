import { SPARK_H, SPARK_W, sparkPaths, sparkSeries } from "@/lib/sparkline";

// A thin line with a faint area below it, stretched behind a card's text
// (start page, "General statistics"): decoration only, no axes, no text and
// hidden from screen readers. Nothing when the series has fewer than two values.
export function Sparkline({ values }: { values: (number | null)[] }) {
  const paths = sparkPaths(sparkSeries(values));
  if (!paths) return null;
  return (
    <svg className="gs-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="gs-area" d={paths.area} />
      <path className="gs-line" d={paths.line} />
    </svg>
  );
}
