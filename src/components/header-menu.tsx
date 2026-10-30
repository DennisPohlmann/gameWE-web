"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { type HeaderTab, isCurrentTab } from "@/lib/header-links";

// The header tabs on phones (globals.css, max-width 700px): a menu button
// that opens them as a list under the header. A <details>, so it also opens
// before the scripts are loaded; with them it closes on a tap outside, on
// Esc, on a tap on a link and when the page changes. The tabs of the desktop
// header (.tabs-top) stay in the page and are hidden there instead.
export function HeaderMenu({ tabs, label, navLabel }: { tabs: HeaderTab[]; label: string; navLabel: string }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      ref.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <details ref={ref} className="header-menu" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary aria-label={label}>
        <span className="header-menu-icon" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
        <span className="header-menu-label">{label}</span>
      </summary>
      <nav className="header-menu-list" aria-label={navLabel}>
        {tabs.map((tab) => {
          const current = isCurrentTab(tab, path) ? ("page" as const) : undefined;
          return tab.kind === "page" ? (
            <Link prefetch={false} key={tab.id} href={tab.href} aria-current={current} onClick={() => setOpen(false)}>
              {tab.label}
            </Link>
          ) : (
            <a key={tab.id} href={tab.href} onClick={() => setOpen(false)} {...(tab.kind === "external" ? { target: "_blank", rel: "noopener" } : {})}>
              {tab.label}
            </a>
          );
        })}
      </nav>
    </details>
  );
}
