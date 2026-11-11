"use client";

// Fills a log token field with a new random token (24 random bytes as hex,
// like openssl rand -hex 24) and shows it, so that it can be copied into
// server.cfg before saving: after saving it is never shown again.
export function TokenGenerate({ target, label }: { target: string; label: string }) {
  const fill = () => {
    const el = document.getElementById(target);
    if (!(el instanceof HTMLInputElement)) return;
    el.value = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, "0")).join("");
    el.type = "text";
    el.select();
  };
  return (
    <button type="button" className="button" onClick={fill}>
      {label}
    </button>
  );
}
