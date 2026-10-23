"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Re-renders the server component every few seconds while something is
// still running (e.g. a queued reset job).
export function AutoRefresh({ seconds = 3 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
