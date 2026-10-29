"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

// The badges and the "!" of ban-badges.tsx (rendered on the server).
const SEL = ".ban-type[data-tip], .ban-mark[data-tip]";

const banEl = (t: EventTarget | null) => (t instanceof Element ? t.closest(SEL) : null);

// The details box of the ban badges and the "!" behind a banned player's
// name, once per page: it opens on hover, on focus and on a tap, closes on
// Escape, a tap elsewhere or when the pointer leaves an unfocused badge. The
// box is fixed to the viewport, so no table or scroll box cuts it off; it
// sits below the badge (above when there is no room) and is kept inside the
// viewport on both sides. Without JavaScript the CSS box of globals.css
// stays (html without the "ban-tips-js" class).
export function BanTips() {
  const tipRef = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ el: Element; text: string } | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const place = () => {
    const box = tipRef.current;
    if (!tip || !box) return;
    const b = tip.el.getBoundingClientRect();
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const gap = 4;
    const left = Math.max(8, Math.min(b.left + b.width / 2 - w / 2, vw - w - 8));
    const above = b.bottom + gap + h > vh - 8 && b.top - gap - h >= 8;
    setPos({ left, top: above ? b.top - gap - h : b.bottom + gap });
  };
  useLayoutEffect(place, [tip]);

  useEffect(() => {
    document.documentElement.classList.add("ban-tips-js");
    const show = (el: Element | null) => el && setTip((t) => (t?.el === el ? t : { el, text: el.getAttribute("data-tip") ?? "" }));
    const hide = (el: Element) => setTip((t) => (t?.el === el ? null : t));
    const over = (e: PointerEvent) => e.pointerType === "mouse" && show(banEl(e.target));
    const out = (e: PointerEvent) => {
      const el = banEl(e.target);
      if (e.pointerType === "mouse" && el && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget)) && document.activeElement !== el) hide(el);
    };
    const down = (e: PointerEvent) => {
      if (!banEl(e.target)) setTip(null);
    };
    const click = (e: MouseEvent) => show(banEl(e.target));
    const focusIn = (e: FocusEvent) => show(banEl(e.target));
    const focusOut = (e: FocusEvent) => {
      const el = banEl(e.target);
      if (el && !el.matches(":hover")) hide(el);
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && setTip(null);
    document.addEventListener("pointerover", over);
    document.addEventListener("pointerout", out);
    document.addEventListener("pointerdown", down);
    document.addEventListener("click", click);
    document.addEventListener("focusin", focusIn);
    document.addEventListener("focusout", focusOut);
    document.addEventListener("keydown", key);
    return () => {
      document.documentElement.classList.remove("ban-tips-js");
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
    if (!tip) return;
    window.addEventListener("scroll", place, { passive: true, capture: true });
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, { capture: true });
      window.removeEventListener("resize", place);
    };
  }, [tip]);

  if (!tip) return null;
  // The badge carries the same text as its aria-label, so screen readers do
  // not need the box.
  return (
    <div ref={tipRef} className="ban-tip" aria-hidden="true" style={pos ? { left: pos.left, top: pos.top } : { left: 0, top: 0, visibility: "hidden" }}>
      {tip.text}
    </div>
  );
}
