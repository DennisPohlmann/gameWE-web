"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Sends an old link to a card that moved to another page (e.g.
// /admin/rankings#hall-of-fame, now on /admin/reset) on to its new place.
// The fragment never reaches the server, so this is done in the browser.
export function HashRedirect({ hash, to }: { hash: string; to: string }) {
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash === `#${hash}`) router.replace(to);
  }, [hash, to, router]);
  return null;
}
