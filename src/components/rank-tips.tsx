"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

export type RankTipItem = { key: string | number; badge: ReactNode; tip: ReactNode };

// A row of rank badges with a detail box each (career row of the player
// page): the box opens on hover, on focus and on a tap, closes on Escape, a
// tap elsewhere or when the pointer leaves an unpinned badge. Only one box is
// open at a time; it sits above the badge (below when there is no room) and
// is kept inside the viewport.
export function RankTips({ items }: { items: RankTipItem[] }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const btns = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState<{ i: number; pinned: boolean } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  const place = () => {
    const btn = open ? btns.current[open.i] : null;
    const tip = tipRef.current;
    if (!btn || !tip) return;
    const b = btn.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const gap = 6;
    const left = Math.max(8, Math.min(b.left + b.width / 2 - w / 2, vw - w - 8));
    const below = b.top - gap - h < 8;
    setPos({ left, top: below ? b.bottom + gap : b.top - gap - h, below });
  };
  useLayoutEffect(place, [open]);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !root.current?.contains(e.target)) setOpen(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", place, { passive: true, capture: true });
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", key);
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const tipId = `${id}-tip`;
  return (
    <div ref={root} className="rank-tips">
      {items.map((it, i) => (
        <button
          key={it.key}
          ref={(el) => {
            btns.current[i] = el;
          }}
          type="button"
          className={open?.i === i ? "rank-tip-btn open" : "rank-tip-btn"}
          aria-describedby={open?.i === i ? tipId : undefined}
          onPointerEnter={(e) => e.pointerType === "mouse" && !open?.pinned && setOpen({ i, pinned: false })}
          onPointerLeave={(e) => e.pointerType === "mouse" && setOpen((o) => (o && !o.pinned ? null : o))}
          onFocus={() => setOpen((o) => (o?.i === i ? o : { i, pinned: false }))}
          onBlur={(e) => !root.current?.contains(e.relatedTarget) && setOpen(null)}
          onClick={() => setOpen((o) => (o?.i === i && o.pinned ? null : { i, pinned: true }))}
        >
          {it.badge}
        </button>
      ))}
      {open ? (
        <div
          ref={tipRef}
          id={tipId}
          role="tooltip"
          className={`chart-tip rank-tip${pos?.below ? " below" : ""}`}
          style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
        >
          {items[open.i]?.tip}
        </div>
      ) : null}
    </div>
  );
}
