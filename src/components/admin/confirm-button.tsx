"use client";

import { useRef, useState, type ReactNode } from "react";
import { noAutofill } from "@/lib/autofill";

// One way to confirm everywhere in the admin area: the button only opens a
// small dialog ("Delete … for good?"), and only its confirm button submits
// the surrounding form, with `name=value` (the confirmation the server action
// checks). `typed` asks to type a word first (deleting: the object's name).
export type ConfirmText = { cancel: string; typeHint?: string };

export function ConfirmButton({
  label,
  title,
  yes,
  text,
  children,
  name = "confirm",
  value = "1",
  typed,
  className = "button danger",
  disabled,
  check,
  when,
}: {
  label: ReactNode;
  title: string;
  yes: string;
  text: ConfirmText;
  children?: ReactNode; // what happens, below the title
  name?: string;
  value?: string;
  typed?: string; // a word to type before the confirm button works (case and outer spaces aside)
  className?: string;
  disabled?: boolean;
  check?: boolean; // check the form's own fields before the dialog opens
  // Ask only while the form has an element matching this selector (e.g. a
  // checked "on" switch); otherwise the button submits right away.
  when?: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState("");
  const ok = !typed || input.trim().toLocaleLowerCase() === typed.trim().toLocaleLowerCase();
  const open = (e: React.MouseEvent<HTMLButtonElement>) => {
    const form = e.currentTarget.form;
    if (check && !form?.reportValidity()) return;
    if (when && form && !form.querySelector(when)) return form.requestSubmit();
    setInput("");
    dialog.current?.showModal();
  };
  return (
    <>
      <button type="button" className={className} onClick={open} disabled={disabled}>
        {label}
      </button>
      <dialog ref={dialog} className="reset-dialog confirm-dialog" aria-label={title}>
        <h2>{title}</h2>
        {children}
        {typed ? (
          <label className="confirm-typed">
            <span>{(text.typeHint ?? "").split("{w}").flatMap((p, i) => (i ? [<b key={i} dir="auto">{typed}</b>, p] : [p]))}</span>
            <input {...noAutofill} value={input} onChange={(e) => setInput(e.target.value)} autoComplete="off" spellCheck={false} dir="auto" />
          </label>
        ) : null}
        <div className="reset-dialog-buttons">
          <button type="button" className="button" onClick={() => dialog.current?.close()} autoFocus>
            {text.cancel}
          </button>
          <button type="submit" className="button danger solid" name={name} value={value} disabled={!ok}>
            {yes}
          </button>
        </div>
      </dialog>
    </>
  );
}
