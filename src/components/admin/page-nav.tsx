"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./icons";

// The jump bar to the cards of a long admin page (a ranking's page): stays
// below the top bar while scrolling and marks the card in view. Without
// JavaScript the links still jump.
export function PageNav({ label, parts }: { label: string; parts: [string, string, IconName][] }) {
  const [on, setOn] = useState(parts[0]?.[0] ?? "");
  const bar = useRef<HTMLElement>(null);
  // On a phone the bar scrolls sideways: keep the marked link in it.
  useEffect(() => {
    const el = bar.current;
    const a = el?.querySelector<HTMLElement>("a.on");
    if (el && a && el.scrollWidth > el.clientWidth) el.scrollTo({ left: a.offsetLeft - 14, behavior: "smooth" });
  }, [on]);
  useEffect(() => {
    const cards = parts.map(([id]) => document.getElementById(id)).filter((e): e is HTMLElement => e !== null);
    if (!cards.length || typeof IntersectionObserver === "undefined") return;
    // A card counts as in view once its top passed the bar (top 140 px).
    const seen = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) seen.set(e.target.id, e.isIntersecting);
        const first = cards.find((c) => seen.get(c.id));
        if (first) setOn(first.id);
      },
      { rootMargin: "-140px 0px -45% 0px" },
    );
    for (const c of cards) io.observe(c);
    return () => io.disconnect();
  }, [parts]);
  return (
    <nav ref={bar} className="page-nav" aria-label={label}>
      <span className="page-nav-label">{label}</span>
      {parts.map(([id, l, icon]) => (
        <a key={id} href={`#${id}`} className={on === id ? "on" : undefined} aria-current={on === id ? "location" : undefined} onClick={() => setOn(id)}>
          <Icon name={icon} />
          {l}
        </a>
      ))}
    </nav>
  );
}
