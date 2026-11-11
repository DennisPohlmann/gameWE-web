"use client";

import { useEffect, useRef, useState } from "react";

// Small Steam avatar in front of a name. Without a picture, or when it does
// not load, a question mark is shown instead.
export function MiniAvatar({ src, fallback }: { src: string | null; fallback: string }) {
  const ref = useRef<HTMLImageElement>(null);
  // The address that did not load, not a flag: after consent the page is
  // refreshed in place and src changes from null to the picture, which then
  // gets its own try.
  const [failed, setFailed] = useState<string | null>(null);
  // An error before hydration fires no onError, so check after it.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(src);
  }, [src]);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} className="mini-avatar" src={src && failed !== src ? src : fallback} alt="" width={20} height={20} referrerPolicy="no-referrer" onError={() => setFailed(src)} />
  );
}
