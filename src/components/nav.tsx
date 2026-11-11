"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

// The "Sections" block of a ranking: icon and name per section, as on gameME.
// A link prefetches its page (up to the ranking's loading.tsx, as the pages
// are dynamic) when the pointer reaches it, a finger touches it or it gets
// focus, so the click shows the skeleton at once. Not all of them on every
// page view: that were 20 extra server requests per view (589 ms server time).
export function GameNav({ game, items }: { game: string; items: { href: string; label: string; icon: string }[] }) {
  const path = usePathname();
  const router = useRouter();
  return (
    <ul className="sections">
      {items.map((it) => {
        const href = `/${game}${it.href}`;
        const active = it.href === "" ? path === href || path.startsWith(`${href}/servers/`) : path === href || path.startsWith(`${href}/`);
        return (
          <li key={it.href}>
            <Link
              href={href}
              prefetch={false}
              onPointerEnter={() => router.prefetch(href)}
              onTouchStart={() => router.prefetch(href)}
              onFocus={() => router.prefetch(href)}
              className={active ? "active" : undefined}
              aria-current={active ? "page" : undefined}
            >
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
