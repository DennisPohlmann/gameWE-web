"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Sections, blocks and boxes of a page that start below the visible part
// slide up a little and fade in when they are scrolled into view (also those
// streamed in later, e.g. the start page's statistics). Parts visible at load
// stay as they are, so nothing moves before the first scroll. Off for
// "reduce motion" and for automated browsers (screenshots, tests), and
// without JavaScript everything is shown as before.
const SELECTOR = ".page .section, .page .block, .page .box, .page .gs-card, .page .award-board";

export function Reveal() {
  const path = usePathname();
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.webdriver || !("IntersectionObserver" in window)) return;
    const seen = new WeakSet<Element>();
    // Elements that come into view together appear one after the other.
    const io = new IntersectionObserver(
      (entries) => {
        let n = 0;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const el = e.target as HTMLElement;
          el.style.transitionDelay = `${Math.min(n++, 5) * 70}ms`;
          el.classList.add("revealed");
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    const scan = () => {
      for (const el of document.querySelectorAll(SELECTOR)) {
        if (seen.has(el)) continue;
        seen.add(el);
        // Nested parts (a box in a section) move with their parent.
        if (el.parentElement?.closest(".reveal")) continue;
        if (el.getBoundingClientRect().top < window.innerHeight) continue;
        el.classList.add("reveal");
        io.observe(el);
      }
    };
    scan();
    const mo = new MutationObserver(scan);
    const page = document.querySelector(".page");
    if (page) mo.observe(page, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [path]);
  return null;
}
