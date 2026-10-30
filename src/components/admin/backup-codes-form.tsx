"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import type { BackupCodesState } from "@/app/admin/actions";

// Turning TOTP on, or making new backup codes (Admin → My account → TOTP):
// the current code from the app, then the ten backup codes come back from
// the server action once and are shown in a dialog to copy or save as a
// file. They are never put into the URL and are gone when the dialog is
// closed; closing it reloads the page (TOTP now on, the new count).
export type BackupCodesText = {
  code: string;
  hint: string;
  submit: string;
  title: string;
  once: string;
  copy: string;
  copied: string;
  save: string;
  done: string;
  invalid: string;
};

export function BackupCodesForm({
  action,
  text,
  user,
  site,
}: {
  action: (prev: BackupCodesState, form: FormData) => Promise<BackupCodesState>;
  text: BackupCodesText;
  user: string;
  site: string;
}) {
  const [state, run, pending] = useActionState(action, {});
  const [shown, setShown] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.codes) return;
    setShown(state.codes);
    setCopied(false);
    form.current?.reset();
    dialog.current?.showModal();
  }, [state]);

  const asText = () => `${site} (${user}): ${text.title}\n\n${(shown ?? []).join("\n")}\n`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      setCopied(true);
    } catch {
      // No clipboard (e.g. plain http): the list is selected for Ctrl+C.
      const list = dialog.current?.querySelector("ol");
      if (list) window.getSelection()?.selectAllChildren(list);
    }
  };
  const save = () => {
    const url = URL.createObjectURL(new Blob([asText()], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${site.replace(/[^A-Za-z0-9._-]+/g, "-") || "gameWE"}-backup-codes.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {state.error && !pending ? <p className="notice error">{text.invalid}</p> : null}
      <form ref={form} action={run} className="form">
        <label>
          {text.code}
          <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} required />
          <small>{text.hint}</small>
        </label>
        <button type="submit" className="button" disabled={pending}>
          {text.submit}
        </button>
      </form>
      <dialog
        ref={dialog}
        className="reset-dialog token-dialog"
        aria-labelledby="backup-codes-title"
        onClose={() => {
          setShown(null);
          setCopied(false);
          router.refresh();
        }}
      >
        <h2 id="backup-codes-title">{text.title}</h2>
        <p>{text.once}</p>
        <ol className="backup-codes mono">
          {(shown ?? []).map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ol>
        <div className="reset-dialog-buttons">
          <button type="button" className="button" onClick={copy}>
            {copied ? text.copied : text.copy}
          </button>
          <button type="button" className="button" onClick={save}>
            {text.save}
          </button>
          <button type="button" className="button primary" onClick={() => dialog.current?.close()}>
            {text.done}
          </button>
        </div>
      </dialog>
    </>
  );
}
