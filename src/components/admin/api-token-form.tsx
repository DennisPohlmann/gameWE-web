"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { TokenFormState } from "@/app/admin/actions";
import { noAutofill } from "@/lib/autofill";

// Creating an API token (Admin → My account → API tokens): name, expiry and
// the password (and TOTP code) to confirm. The new token comes back from the
// server action once and is shown in a dialog with a copy button; it is
// never put into the URL and is gone when the dialog is closed.
export type TokenFormText = {
  name: string;
  nameHint: string;
  expiry: string;
  never: string;
  days: string;
  password: string;
  code: string;
  create: string;
  shownTitle: string;
  shownOnce: string;
  copy: string;
  copied: string;
  use: string;
  done: string;
  errors: Record<NonNullable<TokenFormState["error"]>, string>;
};

export function ApiTokenForm({
  action,
  text,
  expiries,
  totp,
}: {
  action: (prev: TokenFormState, form: FormData) => Promise<TokenFormState>;
  text: TokenFormText;
  expiries: number[];
  totp: boolean;
}) {
  const [state, run, pending] = useActionState(action, {});
  const [shown, setShown] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.token) return;
    setShown(state.token);
    setCopied(false);
    form.current?.reset();
    dialog.current?.showModal();
  }, [state]);

  const copy = async () => {
    if (!shown) return;
    try {
      await navigator.clipboard.writeText(shown);
      setCopied(true);
    } catch {
      // No clipboard (e.g. plain http): the field is selected for Ctrl+C.
      const input = dialog.current?.querySelector("input");
      input?.select();
    }
  };

  return (
    <>
      {state.error && !pending ? <p className="notice error">{text.errors[state.error]}</p> : null}
      <form ref={form} action={run} className="form">
        <label>
          {text.name}
          <input {...noAutofill} name="name" maxLength={40} required />
          <small>{text.nameHint}</small>
        </label>
        <label>
          {text.expiry}
          <select {...noAutofill} name="expiry" defaultValue="90">
            {expiries.map((d) => (
              <option key={d} value={d}>
                {d ? text.days.replace("{n}", String(d)) : text.never}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text.password}
          <input type="password" name="password" autoComplete="current-password" required />
        </label>
        {totp ? (
          <label>
            {text.code}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
          </label>
        ) : null}
        <button type="submit" className="button" disabled={pending}>
          {text.create}
        </button>
      </form>
      <dialog
        ref={dialog}
        className="reset-dialog token-dialog"
        aria-labelledby="token-dialog-title"
        onClose={() => {
          setShown(null);
          setCopied(false);
        }}
      >
        <h2 id="token-dialog-title">{text.shownTitle}</h2>
        <p>{text.shownOnce}</p>
        <div className="token-shown">
          <input {...noAutofill} readOnly value={shown ?? ""} className="mono" aria-label={text.shownTitle} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="button" onClick={copy}>
            {copied ? text.copied : text.copy}
          </button>
        </div>
        <p className="muted small">{text.use}</p>
        <div className="reset-dialog-buttons">
          <button type="button" className="button" onClick={() => dialog.current?.close()}>
            {text.done}
          </button>
        </div>
      </dialog>
    </>
  );
}
