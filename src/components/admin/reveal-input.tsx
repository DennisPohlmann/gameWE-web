"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "./icons";

// A secret's input (log secret, RCON password …) with a button that shows
// what was typed, to check it for typos. A password field by default; the
// button only switches the type in the browser. The stored value is never
// sent to the page (SecretControl), so only the new input can be shown.
export function RevealInput({ show, hide, ...input }: InputHTMLAttributes<HTMLInputElement> & { show: string; hide: string }) {
  const [shown, setShown] = useState(false);
  return (
    <span className="reveal">
      <input {...input} type={shown ? "text" : "password"} />
      <button
        type="button"
        className="reveal-btn"
        aria-label={shown ? hide : show}
        title={shown ? hide : show}
        aria-pressed={shown}
        aria-controls={input.id}
        disabled={input.disabled}
        onClick={() => setShown((v) => !v)}
      >
        <Icon name={shown ? "eyeOff" : "eye"} />
      </button>
    </span>
  );
}
