"use client";

import { useEffect } from "react";

// A secret shown once must not come back with Back/Forward: a page restored
// from the browser's back-forward cache runs `forget` (close the dialog,
// drop the secret).
export function useForgetOnRestore(forget: () => void) {
  useEffect(() => {
    const f = (e: PageTransitionEvent) => e.persisted && forget();
    window.addEventListener("pageshow", f);
    return () => window.removeEventListener("pageshow", f);
  });
}
