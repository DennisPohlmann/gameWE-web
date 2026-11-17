"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

// A small "?" next to a label with a longer explanation in a bubble. It
// opens on mouse hover and on keyboard focus, a click or tap keeps it open
// (phones have no hover); Escape, a tap outside or a second click closes
// it. The text is the button's description (aria-describedby), so a
// screen reader reads it on focus. The bubble moves sideways to stay
// inside the window and opens above the button when there is no room below.
// Not a <button>: the settings form sits in a fieldset that is disabled for
// admins who may only look, and that would disable the "?" as well.
export function HelpTip({ text, label }: { text: string; label: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const hover = useRef(false);
  const box = useRef<HTMLSpanElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);

  const close = () => {
    pinned.current = false;
    setOpen(false);
  };

  const toggle = () => {
    pinned.current = !pinned.current;
    setOpen(pinned.current);
  };

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  useLayoutEffect(() => {
    const b = bubble.current;
    if (!open || !b) return;
    b.style.translate = "";
    b.classList.remove("up");
    const gap = 8;
    const r = b.getBoundingClientRect();
    const width = document.documentElement.clientWidth;
    const dx = r.left < gap ? gap - r.left : r.right > width - gap ? width - gap - r.right : 0;
    if (dx) b.style.translate = `${Math.round(dx)}px 0`;
    if (r.bottom > window.innerHeight - gap && r.top - r.height - 30 > gap) b.classList.add("up");
  }, [open]);

  return (
    <span
      className="help-tip"
      ref={box}
      onMouseEnter={() => {
        hover.current = true;
        setOpen(true);
      }}
      onMouseLeave={() => {
        hover.current = false;
        if (!pinned.current) setOpen(false);
      }}
    >
      <span
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        // A click on the bubble's text also blurs the button: keep it open then.
        onBlur={() => hover.current || close()}
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          toggle();
        }}
      >
        ?
      </span>
      <span role="tooltip" id={id} ref={bubble} className="help-tip-bubble" hidden={!open}>
        {text}
      </span>
    </span>
  );
}
