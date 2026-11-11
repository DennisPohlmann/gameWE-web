"use client";

import { useActionState, useState } from "react";
import type { BackupCodesState, TotpStartState } from "@/app/admin/actions";
import { noAutofill } from "@/lib/autofill";
import { BackupCodesForm, type BackupCodesText } from "./backup-codes-form";
import { useForgetOnRestore } from "./forget-on-restore";
import { RevealInput } from "./reveal-input";

// Setting up TOTP (Admin → My account): the start answers with a new key,
// its otpauth link and QR code, shown once in this component only. After a
// reload a started setup shows neither (started): the code from the app
// confirms it, or a restart makes a new key.
export function TotpSetup({
  start,
  confirm,
  cancel,
  started,
  disabled,
  text,
  backup,
  user,
  site,
}: {
  start: () => Promise<TotpStartState>;
  confirm: (prev: BackupCodesState, form: FormData) => Promise<BackupCodesState>;
  cancel: () => Promise<void>;
  started: boolean;
  disabled: boolean;
  text: { off: string; start: string; restart: string; gone: string; qr: string; key: string; uri: string; show: string; hide: string; cancel: string };
  backup: BackupCodesText;
  user: string;
  site: string;
}) {
  const [state, run, busy] = useActionState(start, {});
  const [forgotten, setForgotten] = useState<TotpStartState | null>(null);
  useForgetOnRestore(() => setForgotten(state));
  const shown = state.key && state !== forgotten ? state : null;
  const begun = started || Boolean(state.key);
  return (
    <>
      {shown?.qr ? (
        <>
          <p>{text.qr}</p>
          <svg className="qr" role="img" aria-label={text.uri} width={220} height={220} viewBox={`0 0 ${shown.qr.size} ${shown.qr.size}`} shapeRendering="crispEdges">
            <rect width={shown.qr.size} height={shown.qr.size} fill="#fff" />
            <path d={shown.qr.d} fill="#000" />
          </svg>
          <label>
            {text.key}
            <RevealInput {...noAutofill} show={text.show} hide={text.hide} readOnly value={(shown.key ?? "").replace(/(.{4})/g, "$1 ").trim()} className="mono" />
          </label>
          <label>
            {text.uri}
            <RevealInput {...noAutofill} show={text.show} hide={text.hide} readOnly value={shown.uri ?? ""} className="mono" />
          </label>
        </>
      ) : (
        <>
          <p className={begun ? "notice" : undefined}>{begun ? text.gone : text.off}</p>
          <form action={run}>
            <button type="submit" className="button" disabled={disabled || busy}>
              {begun ? text.restart : text.start}
            </button>
          </form>
        </>
      )}
      {begun ? (
        <>
          <BackupCodesForm action={confirm} text={backup} user={user} site={site} />
          <form action={cancel}>
            <button type="submit" className="linkish">
              {text.cancel}
            </button>
          </form>
        </>
      ) : null}
    </>
  );
}
