"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Breadcrumbs of the nav bar, as on gameME: "Site: <Rangliste>: <Bereich>".
// Every part is a link; the last one (bold) leads to the start of its area,
// e.g. "Players" back to the first page of the player ranking.
export function Crumbs({
  site,
  statistics,
  games,
  sections,
  pages,
}: {
  site: { name: string; url: string };
  statistics: string;
  games: Record<string, string>;
  sections: Record<string, string>;
  // Pages outside the rankings (search, help).
  pages: Record<string, string>;
}) {
  const [code, section] = usePathname().split("/").filter(Boolean);
  const game = code && Object.hasOwn(games, code) ? games[code] : undefined;
  const items = [
    site.url ? (
      <a key="site" href={site.url}>
        <bdi>{site.name}</bdi>
      </a>
    ) : (
      <Link prefetch={false} key="site" href="/">
        <bdi>{site.name}</bdi>
      </Link>
    ),
  ];
  if (game) items.push(<Link prefetch={false} key="game" href={`/${code}`}><bdi>{game}</bdi></Link>);
  const last = game ? sections[section ?? ""] : code && Object.hasOwn(pages, code) ? pages[code] : undefined;
  const lastHref = game && section ? `/${code}/${section}` : `/${code ?? ""}`;
  return (
    <nav className="crumbs" aria-label={statistics}>
      {items.map((it, i) => (
        <span key={i}>
          {it}
          {i < items.length - 1 || last ? ": " : ""}
        </span>
      ))}
      {last ? (
        <Link prefetch={false} href={lastHref} aria-current="page">
          <strong>{last}</strong>
        </Link>
      ) : null}
    </nav>
  );
}
