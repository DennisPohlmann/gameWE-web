"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";

// A <details> drop-down of the admin header (the user menu). The layout stays
// mounted across pages and a plain <details> only closes on its own summary,
// so this one also closes on a click or tap outside, on Escape (focus back to
// the summary), on a click on one of its links or buttons, and after every
// page change.
export function MenuDetails({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (ref.current) ref.current.open = false;
  }, [pathname]);

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      const d = ref.current;
      if (d?.open && !d.contains(e.target as Node)) d.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      const d = ref.current;
      if (e.key !== "Escape" || !d?.open) return;
      d.open = false;
      d.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);

  return (
    <details
      className={className}
      ref={ref}
      onClick={(e) => {
        // Not the summary itself: its click is the native toggle.
        const hit = (e.target as Element).closest("a, button");
        if (hit && ref.current) ref.current.open = false;
      }}
    >
      {children}
    </details>
  );
}
