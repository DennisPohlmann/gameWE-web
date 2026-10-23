"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Breadcrumbs of the nav bar, as on gameME: "Site: <Rangliste>: <Bereich>".
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
        {site.name}
      </a>
    ) : (
      <Link key="site" href="/">
        {site.name}
      </Link>
    ),
  ];
  if (game) items.push(<Link key="game" href={`/${code}`}>{game}</Link>);
  const last = game ? sections[section ?? ""] : code && Object.hasOwn(pages, code) ? pages[code] : undefined;
  return (
    <nav className="crumbs" aria-label={statistics}>
      {items.map((it, i) => (
        <span key={i}>
          {it}
          {i < items.length - 1 || last ? ": " : ""}
        </span>
      ))}
      {last ? <strong>{last}</strong> : null}
    </nav>
  );
}
