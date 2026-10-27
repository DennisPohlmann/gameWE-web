"use client";

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

// Only plain colours as inline style, nothing that could load a URL.
const isColor = (s: string) => /^(#[0-9a-f]{3,8}|rgb\(\d{1,3},\d{1,3},\d{1,3}\))$/i.test(s);

// Hover box for server-rendered graphics: an element inside with a data-tip
// attribute shows that text next to the pointer (lines split at "\n"; see
// tipText for rows with a swatch). A tap shows it too and keeps it until the
// next tap (touch pointers leave the box right after the tap); a tap outside
// the box closes it.
export function HoverTip({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<{ text: string; left: number; top: number; flip: boolean } | null>(null);
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const box = ref.current;
    const el = e.target instanceof Element ? e.target.closest("[data-tip]") : null;
    if (!box || !el || !box.contains(el)) return setTip(null);
    const r = box.getBoundingClientRect();
    const left = e.clientX - r.left;
    setTip({ text: el.getAttribute("data-tip") ?? "", left, top: e.clientY - r.top - 12, flip: left > r.width / 2 });
  };
  const open = tip !== null;
  useEffect(() => {
    if (!open) return;
    const close = (e: globalThis.PointerEvent) => {
      if (!(e.target instanceof Node && ref.current?.contains(e.target))) setTip(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);
  const [head, ...rest] = (tip?.text ?? "").split("\n");
  return (
    <div ref={ref} className={`hover-tip${className ? ` ${className}` : ""}`} onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={(e) => e.pointerType !== "touch" && setTip(null)}>
      {children}
      {tip?.text ? (
        <div className={`chart-tip${tip.flip ? " flip" : ""}`} style={{ left: tip.left, top: tip.top }} role="status">
          {head ? <b>{head}</b> : null}
          {rest.map((l, i) => {
            const [swatch, label, value] = l.split("\t");
            return value === undefined ? (
              <span key={i} className="tip-line">
                {l}
              </span>
            ) : (
              <span key={i} className="tip-row">
                <i className={isColor(swatch) ? "swatch" : `swatch ${swatch}`} style={isColor(swatch) ? { background: swatch } : undefined} />
                <span className="tip-name">{label}</span>
                <b>{value}</b>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
