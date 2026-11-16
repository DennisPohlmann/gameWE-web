import Link from "next/link";

// The map page: its name in the address (/css/maps/de_dust2), unique per ranking.
export const mapHref = (game: string, name: string) => `/${game}/maps/${encodeURIComponent(name)}`;

// A map's name, linked to its page with the heatmap; plain text when the map
// has no page (no row in hlstats_Maps), "-" when there is no name.
export function MapLink({ game, id, name, className }: { game: string; id: number | null | undefined; name: string | null | undefined; className?: string }) {
  if (!name) return "-";
  if (!id) return <bdi>{name}</bdi>;
  return (
    <Link prefetch={false} className={className} href={mapHref(game, name)}>
      <bdi>{name}</bdi>
    </Link>
  );
}
