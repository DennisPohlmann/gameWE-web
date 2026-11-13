"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { LangFlag } from "@/components/lang-flag";
import { LANGUAGES, type Lang } from "@/translations/languages";

// Two overlapping speech bubbles, "A" and "あ": the language symbol, drawn
// in the stroke style of the share icon (currentColor).
export function LangIcon({ size }: { size: number }) {
  return (
    <svg className="lang-icon" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 2.5h9a2 2 0 0 1 2 2v5.5a2 2 0 0 1-2 2H8l-3 2.5v-2.5H3.5a2 2 0 0 1-2-2V4.5a2 2 0 0 1 2-2z" />
      <path d="M5.3 10l2.7-6 2.7 6M6.2 8h3.6" />
      <path d="M11.5 10h9a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H19v2.5l-3-2.5h-4.5a2 2 0 0 1-2-2V12" />
      <path d="M13.2 13.6h5M15.7 12.4c-.2 3.3-.6 5.3-1.4 6M18.6 15.2c-2.6-.5-5 .6-5 2.2 0 1.6 2.6 1.4 4-.1" />
    </svg>
  );
}

// The language choice of the public pages and the admin area: a button like
// the share button (ShareMenu) that opens every language with its flag.
// icon: only the symbol and the code (phone header); the full name stays in
// the label. Links, so the choice also works as plain navigation (/lang/xx).
export function LangMenu({ lang, label, base, icon = false, className }: { lang: Lang; label: string; base: string; icon?: boolean; className?: string }) {
  const [shown, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!shown) return;
    const outside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    // Open: focus the current language, so arrows and Enter go on from there.
    ref.current?.querySelector<HTMLElement>("[aria-current]")?.focus();
    return () => document.removeEventListener("pointerdown", outside);
  }, [shown]);

  const face = (
    <>
      <LangIcon size={icon ? 16 : 13} />
      {icon ? <span className="lang-code">{current.code.split("-")[0].toUpperCase()}</span> : current.name}
    </>
  );
  const links = (menu: boolean) =>
    LANGUAGES.map((l) => (
      <a key={l.code} role={menu ? "menuitem" : undefined} href={`${base}/lang/${l.code}`} hrefLang={l.code} lang={l.code} aria-current={l.code === lang ? "true" : undefined}>
        <LangFlag code={l.flag} title="" />
        {l.name}
      </a>
    ));

  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && shown) {
      e.preventDefault();
      setOpen(false);
      ref.current?.querySelector("button")?.focus();
      return;
    }
    const items = [...(ref.current?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = { ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: items.length - 1 }[e.key];
    if (at < 0 || next === undefined) return;
    e.preventDefault();
    items[(next + items.length) % items.length].focus();
  };

  return (
    <div
      className={`share-nav lang-nav${className ? ` ${className}` : ""}`}
      ref={ref}
      onKeyDown={keys}
      // Tab out of the list closes it, like a tap outside. Only when focus
      // goes to another element: Safari does not focus a tapped link, so
      // relatedTarget is null there and the tap must still reach the link.
      onBlur={(e) => {
        if (shown && e.relatedTarget && !ref.current?.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <button type="button" className="share-btn" aria-expanded={shown} aria-haspopup="menu" aria-label={`${label}: ${current.name}`} onClick={() => setOpen(!shown)}>
        {face}
      </button>
      {shown ? (
        <div className="share-menu lang-list" role="menu" aria-label={label}>
          {links(true)}
        </div>
      ) : null}
      {/* Without JavaScript the button does nothing: the same list as a
          <details> (CSS hides the button, see .lang-nav:has(.lang-noscript)). */}
      <noscript>
        <details className="lang-noscript">
          <summary className="share-btn" aria-label={`${label}: ${current.name}`}>
            {face}
          </summary>
          <div className="share-menu lang-list">{links(false)}</div>
        </details>
      </noscript>
    </div>
  );
}
