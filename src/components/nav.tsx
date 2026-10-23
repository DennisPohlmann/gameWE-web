"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The "Sections" block of a ranking: icon and name per section, as on gameME.
export function GameNav({ game, items }: { game: string; items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  return (
    <ul className="sections">
      {items.map((it) => {
        const href = `/${game}${it.href}`;
        const active = it.href === "" ? path === href || path.startsWith(`${href}/servers/`) : path === href || path.startsWith(`${href}/`);
        return (
          <li key={it.href}>
            <Link href={href} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
              <span className="sec-icon" aria-hidden="true">
                {it.icon}
              </span>
              {it.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
