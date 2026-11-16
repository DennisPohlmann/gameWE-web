"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

// Changes nobody saved yet: once a field of a saving form on the page
// changes, a bar at the bottom of the screen says so and carries the form's
// own save button (it clicks that button, so a dialog in front of it still
// asks), wherever the button is on the page; the form is marked too
// (form[data-dirty] in admin.css). Leaving the page then asks first. Forms
// that only search or filter (GET), confirm with a password (one-off steps
// like a new passkey) or carry data-nodirty are left out; a form with the
// sticky save bar of the settings pages uses that one.
export function UnsavedBar({ text }: { text: { unsaved: string; discard: string } }) {
  const [form, setForm] = useState<HTMLFormElement | null>(null);
  const pathname = usePathname();
  useEffect(() => setForm(null), [pathname]);
  useEffect(() => {
    const tracked = (f: HTMLFormElement | null): f is HTMLFormElement =>
      !!f && f.closest(".adm-main") !== null && f.method.toLowerCase() === "post" && !f.hasAttribute("data-nodirty") && !f.querySelector("input[type=password]");
    const change = (e: Event) => {
      const t = e.target as HTMLElement;
      if (t.closest("dialog")) return;
      const f = (t as HTMLInputElement).form ?? t.closest("form");
      if (!tracked(f)) return;
      f.dataset.dirty = "1";
      setForm(f.querySelector(".savebar") ? null : f);
    };
    const submit = (e: Event) => {
      const f = e.target as HTMLFormElement;
      delete f.dataset.dirty;
      setForm((cur) => (cur === f ? null : cur));
    };
    const leave = (e: BeforeUnloadEvent) => {
      if (document.querySelector(".adm-main form[data-dirty]")) e.preventDefault();
    };
    document.addEventListener("input", change, true);
    document.addEventListener("change", change, true);
    document.addEventListener("submit", submit, true);
    window.addEventListener("beforeunload", leave);
    return () => {
      document.removeEventListener("input", change, true);
      document.removeEventListener("change", change, true);
      document.removeEventListener("submit", submit, true);
      window.removeEventListener("beforeunload", leave);
    };
  }, []);
  if (!form || !form.isConnected) return null;
  // The form's own save button: the last button outside a dialog that saves.
  const buttons = [...form.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.closest("dialog") && (b.type === "submit" || b.classList.contains("primary")) && !b.disabled);
  const save = buttons.at(-1);
  if (!save) return null;
  return (
    <div className="unsaved-bar" role="status">
      <span className="msg">
        <i aria-hidden="true" />
        {text.unsaved}
      </span>
      <span className="btns">
        <button
          type="button"
          className="button"
          onClick={() => {
            // Back to the stored values: the page loads again.
            for (const f of document.querySelectorAll<HTMLFormElement>("form[data-dirty]")) delete f.dataset.dirty;
            window.location.reload();
          }}
        >
          {text.discard}
        </button>
        <button type="button" className="button primary" onClick={() => save.click()}>
          {save.textContent}
        </button>
      </span>
    </div>
  );
}
