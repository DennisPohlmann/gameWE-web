"use client";

import { useEffect, useRef, useState } from "react";
import { LangFlag } from "@/components/lang-flag";
import { LANGUAGES, type Lang } from "@/translations/languages";

// The language choice on phones (globals.css, max-width 700px): a button with
// a globe, the flag and the code of the current language that opens the
// languages as a list, instead of the row of flags of wide screens (.langs,
// hidden there). A <details>, so it also opens before the scripts are
// loaded; with them it closes on a tap outside and on Esc.
export function LangMenu({ lang, label, base }: { lang: Lang; label: string; base: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDetailsElement>(null);
  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      ref.current?.querySelector("summary")?.focus();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  return (
    <details ref={ref} className="lang-menu" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary aria-label={`${label}: ${current.name}`}>
        <svg className="lang-globe" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
        </svg>
        <LangFlag code={current.flag} title={current.name} />
        <span className="lang-code">{current.code.slice(0, 2).toUpperCase()}</span>
        <span className="lang-caret" aria-hidden="true" />
      </summary>
      <nav className="lang-menu-list" aria-label={label}>
        {LANGUAGES.map((l) => (
          <a key={l.code} href={`${base}/lang/${l.code}`} hrefLang={l.locale} lang={l.locale} aria-current={l.code === lang ? "true" : undefined}>
            <LangFlag code={l.flag} title="" />
            {l.name}
          </a>
        ))}
      </nav>
    </details>
  );
}
