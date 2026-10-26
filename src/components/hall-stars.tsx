// Hall of fame stars, as the stars above a world champion's crest: one per
// place in the top three (gold, silver, bronze), best first. From six stars
// of a colour on, the colour shows as one star with its count.
export function HallStars({ gold, silver, bronze, label }: { gold: number; silver: number; bronze: number; label: string }) {
  if (gold + silver + bronze <= 0) return null;
  const group = (n: number, kind: string) =>
    n <= 0 ? null : n > 5 ? (
      <span className={`hof-star hof-${kind}`}>
        ★<small>×{n}</small>
      </span>
    ) : (
      <span className={`hof-star hof-${kind}`}>{"★".repeat(n)}</span>
    );
  return (
    <span className="hof-stars" role="img" aria-label={label} title={label}>
      {group(gold, "gold")}
      {group(silver, "silver")}
      {group(bronze, "bronze")}
    </span>
  );
}
