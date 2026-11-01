import { SPARK_H, SPARK_W, sparkBuckets, sparkPaths, type SparkBucket } from "@/lib/sparkline";

// A thin line with a faint area below it, stretched behind a card's text
// (start page, "General statistics"): no axes, no text and hidden from screen
// readers. With `tip` every point of the line gets a strip as high as the
// line's box whose data-tip (HoverTip around the cards) shows that point's
// time and value on hover or tap; the strip under the pointer is shaded.
// Nothing when the series has fewer than two values.
export function Sparkline({ values, tip }: { values: (number | null)[]; tip?: (b: SparkBucket) => string }) {
  const buckets = sparkBuckets(values);
  const paths = sparkPaths(buckets.map((b) => (b.n ? b.sum / b.n : null)));
  if (!paths) return null;
  const step = SPARK_W / (buckets.length - 1);
  const r = (n: number) => Math.round(n * 100) / 100;
  return (
    <svg className="gs-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="gs-area" d={paths.area} />
      <path className="gs-line" d={paths.line} />
      {tip
        ? buckets.map((b, i) => {
            if (!b.n) return null;
            const x = Math.max(0, i * step - step / 2);
            const w = Math.min(SPARK_W, i * step + step / 2) - x;
            return <rect key={i} className="gs-hit" x={r(x)} y={0} width={r(w)} height={SPARK_H} data-tip={tip(b)} />;
          })
        : null}
    </svg>
  );
}
