"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { rankName } from "@/components/badges";
import { rankFor, rankStep, type Rank } from "@/lib/career";
import { fmtNum, fmtPct } from "@/lib/format";
import type { Lang } from "@/translations/languages";

export type RankCellTexts = { noRankYet: string; currentRank: string; kills: string; nextRankName: string; killsNeeded: string; topRank: string };

// The rank badges of one ranking table (rank-cell.tsx, plain server markup
// with the player's kills in data-rank-tip) share this one detail box instead
// of one client component per row: the box is built here from the ranks and
// the kills. It opens on hover, on focus and on a tap (a tap pins it), closes
// on Escape, a tap elsewhere or when the pointer leaves an unpinned badge.
// Like the career row (rank-tips.tsx) it sits above the badge, below when
// there is no room, and stays inside the viewport. Only badges inside its own
// table box count, so two tables on a page do not both answer.
const SEL = "button[data-rank-tip]";
const TIP_ID = "rank-cell-tip";

const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? "");

export function RankCellTips({ ranks, texts: t, lang }: { ranks: Rank[]; texts: RankCellTexts; lang: Lang }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState<{ btn: HTMLButtonElement; pinned: boolean } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number; below: boolean } | null>(null);

  const place = () => {
    const tip = tipRef.current;
    if (!open || !tip) return;
    const b = open.btn.getBoundingClientRect();
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const gap = 6;
    const left = Math.max(8, Math.min(b.left + b.width / 2 - w / 2, vw - w - 8));
    const below = b.top - gap - h < 8;
    setPos({ left, top: below ? b.bottom + gap : b.top - gap - h, below });
  };

  useLayoutEffect(() => {
    if (!open) return;
    open.btn.classList.add("open");
    open.btn.setAttribute("aria-describedby", TIP_ID);
    place();
    const btn = open.btn;
    return () => {
      btn.classList.remove("open");
      btn.removeAttribute("aria-describedby");
    };
  }, [open]);

  useEffect(() => {
    const own = (t: EventTarget | null) => {
      const btn = t instanceof Element ? (t.closest(SEL) as HTMLButtonElement | null) : null;
      const box = anchor.current?.parentElement;
      return btn && box?.contains(btn) ? btn : null;
    };
    const over = (e: PointerEvent) => {
      const btn = own(e.target);
      if (e.pointerType === "mouse" && btn) setOpen((o) => (o?.pinned || o?.btn === btn ? o : { btn, pinned: false }));
    };
    const out = (e: PointerEvent) => {
      const btn = own(e.target);
      if (e.pointerType !== "mouse" || !btn || (e.relatedTarget instanceof Node && btn.contains(e.relatedTarget))) return;
      setOpen((o) => (o?.btn === btn && !o.pinned && document.activeElement !== btn ? null : o));
    };
    const down = (e: PointerEvent) => {
      if (!own(e.target)) setOpen(null);
    };
    const click = (e: MouseEvent) => {
      const btn = own(e.target);
      if (btn) setOpen((o) => (o?.btn === btn && o.pinned ? null : { btn, pinned: true }));
    };
    const focusIn = (e: FocusEvent) => {
      const btn = own(e.target);
      if (btn) setOpen((o) => (o?.btn === btn ? o : { btn, pinned: false }));
    };
    const focusOut = (e: FocusEvent) => {
      const btn = own(e.target);
      if (btn && !btn.matches(":hover")) setOpen((o) => (o?.btn === btn ? null : o));
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", down);
    document.addEventListener("click", click);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerover", over);
      document.removeEventListener("pointerout", out);
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("click", click);
      document.removeEventListener("focusin", focusIn);
      document.removeEventListener("focusout", focusOut);
      document.removeEventListener("keydown", key);
    };
  }, []);

  // Follow the badge while the page or a table scrolls.
  useEffect(() => {
    if (!open) return;
    window.addEventListener("scroll", place, { passive: true, capture: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const kills = open ? Number(open.btn.dataset.rankTip) || 0 : 0;
  const rank = open ? rankFor(kills, ranks) : undefined;
  const step = open ? rankStep(kills, ranks) : null;
  return (
    <span ref={anchor} className="rank-cell-tips">
      {open ? (
        <div
          ref={tipRef}
          id={TIP_ID}
          role="tooltip"
          className={`chart-tip rank-tip${pos?.below ? " below" : ""}`}
          style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}
        >
          <b>{rank ? rankName(rank.name) : t.noRankYet}</b>
          {rank ? <span className="tip-line rank-tip-state current">{t.currentRank}</span> : null}
          <span className="tip-line">
            {t.kills}: <b>{fmtNum(kills, lang)}</b>
          </span>
          {step ? (
            <>
              <span className="tip-line">{fill(t.nextRankName, { rank: rankName(step.next.name) })}</span>
              <span className="tip-line">{fill(t.killsNeeded, { n: fmtNum(step.needed, lang), pct: fmtPct(step.share, lang) })}</span>
              <span className="tip-line">
                <span className="bar wide" aria-hidden="true">
                  <span style={{ width: `${(step.share * 100).toFixed(1)}%` }} />
                </span>
              </span>
            </>
          ) : (
            <span className="tip-line">{t.topRank}</span>
          )}
        </div>
      ) : null}
    </span>
  );
}
