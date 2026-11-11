"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./icons";

// A secret's input (log secret, RCON password …) with a button that shows
// what was typed, masked by default; the button only switches the type in
// the browser. load: the stored value (SecretControl), fetched on the first
// show of an empty field and put into it; never part of the page itself.
export function RevealInput({ show, hide, load, ...input }: InputHTMLAttributes<HTMLInputElement> & { show: string; hide: string; load?: () => Promise<string> }) {
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const toggle = async () => {
    const el = field.current;
    if (!shown && load && el && !el.value) {
      setBusy(true);
      try {
        el.value = await load();
      } finally {
        setBusy(false);
      }
    }
    setShown((v) => !v);
  };
  return (
    <span className="reveal">
      <input {...input} ref={field} type={shown ? "text" : "password"} />
      <button
        type="button"
        className="reveal-btn"
        aria-label={shown ? hide : show}
        title={shown ? hide : show}
        aria-pressed={shown}
        aria-controls={input.id}
        aria-busy={busy || undefined}
        disabled={input.disabled || busy}
        onClick={toggle}
      >
        <Icon name={shown ? "eyeOff" : "eye"} />
      </button>
    </span>
  );
}
