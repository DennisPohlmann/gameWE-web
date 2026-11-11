"use client";

import { useState } from "react";

// Fills a log token field with a new random token (24 random bytes as hex,
// like openssl rand -hex 24), or with numeric a random sv_logsecret
// (1 to 2147483647), and shows it, with a button to copy it, so that it can
// go into server.cfg right away; after saving the field's eye button shows
// it again.
export function TokenGenerate({ target, label, copy, copied, numeric }: { target: string; label: string; copy: string; copied: string; numeric?: boolean }) {
  const [token, setToken] = useState("");
  const [done, setDone] = useState(false);
  const input = () => {
    const el = document.getElementById(target);
    return el instanceof HTMLInputElement ? el : null;
  };
  const fill = () => {
    const el = input();
    if (!el) return;
    el.value = numeric
      ? String((crypto.getRandomValues(new Uint32Array(1))[0] % 2147483647) + 1)
      : Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    // Shown through the field's eye button (RevealInput), so its state matches.
    const eye = document.querySelector(`button[aria-controls="${target}"][aria-pressed="false"]`);
    if (eye instanceof HTMLButtonElement) eye.click();
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
