import { SPARK_H, SPARK_W, sparkBuckets, sparkHits, sparkPaths, type SparkBucket } from "@/lib/sparkline";

// A thin line with a faint area below it, stretched behind a card's text
// (start page, "General statistics"): no axes, no text and hidden from screen
// readers. With `tip` a layer as large as the card gets a strip per point of
// the line, reaching to the middle between it and the next points. A strip's
// data-tip (HoverTip around the cards) shows that point's time and value on
// hover or tap and a vertical line marks the point (HoverTip sets tip-on).
// Nothing when the series has fewer than two values.
export function Sparkline({ values, tip }: { values: (number | null)[]; tip?: (b: SparkBucket) => string }) {
  const buckets = sparkBuckets(values);
  const paths = sparkPaths(buckets.map((b) => (b.n ? b.sum / b.n : null)));
  if (!paths) return null;
  const r = (n: number) => Math.round(n * 100) / 100;
  return (
    <>
      <svg className="gs-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
        <path className="gs-area" d={paths.area} />
        <path className="gs-line" d={paths.line} />
      </svg>
      {tip ? (
        <svg className="gs-hits" viewBox={`0 0 ${SPARK_W} 1`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {sparkHits(buckets).map(({ bucket, x, from, width }) => {
            // The card's edges would cut the marker of the first and last point in half.
            const mark = r(Math.min(Math.max(x, 0.4), SPARK_W - 0.4));
            return (
              <g key={bucket.from} className="gs-hit" data-tip={tip(bucket)}>
                <rect x={r(from)} y={0} width={r(width)} height={1} />
                <line x1={mark} x2={mark} y1={0} y2={1} />
              </g>
            );
          })}
        </svg>
      ) : null}
    </>
  );
}
