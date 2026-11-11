"use client";

import { useState } from "react";

// Fills a log token field with a new random token (24 random bytes as hex,
// like openssl rand -hex 24) and shows it, with a button to copy it, so that
// it can go into server.cfg before saving: after saving it is never shown
// again.
export function TokenGenerate({ target, label, copy, copied }: { target: string; label: string; copy: string; copied: string }) {
  const [token, setToken] = useState("");
  const [done, setDone] = useState(false);
  const input = () => {
    const el = document.getElementById(target);
    return el instanceof HTMLInputElement ? el : null;
  };
  const fill = () => {
    const el = input();
    if (!el) return;
    el.value = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    el.type = "text";
    el.select();
    setToken(el.value);
    setDone(false);
  };
  const toClipboard = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setDone(true);
    } catch {
      input()?.select(); // no clipboard (e.g. plain http): selected for Ctrl+C
    }
  };
  return (
    <span className="token-generate">
      <button type="button" className="button" onClick={fill}>
        {label}
      </button>{" "}
      {token ? (
        <button type="button" className="button" onClick={toClipboard} aria-live="polite">
          {done ? copied : copy}
        </button>
      ) : null}
    </span>
  );
}
