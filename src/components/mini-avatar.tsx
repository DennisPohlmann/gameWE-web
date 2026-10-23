"use client";

import { useEffect, useRef, useState } from "react";

// Small Steam avatar in front of a name. Without a picture, or when it does
// not load, a question mark is shown instead.
export function MiniAvatar({ src, fallback }: { src: string | null; fallback: string }) {
  const ref = useRef<HTMLImageElement>(null);
  const [failed, setFailed] = useState(!src);
  // An error before hydration fires no onError, so check once after it.
  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img ref={ref} className="mini-avatar" src={failed || !src ? fallback : src} alt="" width={20} height={20} onError={() => setFailed(true)} />
  );
}
