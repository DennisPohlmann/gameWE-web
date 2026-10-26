"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { basePath } from "@/lib/base-path";
import type { Consent } from "@/lib/consent";

// Cookie banner, settings dialog and the consent form (lib/consent.ts).
// Every part is a plain form that posts to /consent, so it works without
// JavaScript (the page then loads anew). With JavaScript ConsentRoot sends
// every such form with fetch and refreshes the page in place, and links with
// data-consent-open open the settings dialog instead of the privacy page.

export type ConsentText = {
  title: string;
  text: string;
  necessaryOnly: string;
  acceptAll: string;
  settings: string;
  save: string;
  close: string;
  privacyLink: string;
  catNecessary: string;
  catNecessaryText: string;
  catMaps: string;
  catMapsText: string;
  catSteam: string;
  catSteamText: string;
  alwaysOn: string;
  saving: string;
  error: string;
};

const ACTION = `${basePath}/consent`;
export const PRIVACY_HREF = `${basePath}/privacy#consent`;

// The form with the categories and the three buttons; also on the privacy
// page (server-rendered there). Checkbox state follows the stored choice.
export function ConsentForm({ consent, t, idPrefix }: { consent: Consent; t: ConsentText; idPrefix: string }) {
  const row = (id: string, title: string, text: string, input: ReactNode) => (
    <div className="consent-cat">
      {input}
      <label htmlFor={id}>
        <b>{title}</b>
        <span>{text}</span>
      </label>
    </div>
  );
  return (
    <form method="post" action={ACTION} className="consent-form" data-consent-form="">
      <fieldset>
        <legend className="sr-only">{t.title}</legend>
        {row(
          `${idPrefix}-necessary`,
          `${t.catNecessary} (${t.alwaysOn})`,
          t.catNecessaryText,
          <input type="checkbox" id={`${idPrefix}-necessary`} checked disabled readOnly />,
        )}
        {row(
          `${idPrefix}-maps`,
          t.catMaps,
          t.catMapsText,
          <input type="checkbox" id={`${idPrefix}-maps`} name="maps" value="1" defaultChecked={consent.maps} />,
        )}
        {row(
          `${idPrefix}-steam`,
          t.catSteam,
          t.catSteamText,
          <input type="checkbox" id={`${idPrefix}-steam`} name="steam" value="1" defaultChecked={consent.steam} />,
        )}
      </fieldset>
      <div className="consent-buttons">
        <button type="submit" name="choice" value="necessary" className="button">
          {t.necessaryOnly}
        </button>
        <button type="submit" name="choice" value="all" className="button">
          {t.acceptAll}
        </button>
        <button type="submit" name="choice" value="save" className="button consent-save">
          {t.save}
        </button>
      </div>
    </form>
  );
}

// "Always allow" on a placeholder: adds one category to the stored choice.
export function AllowForm({ category, label }: { category: "maps" | "steam"; label: string }) {
  return (
    <form method="post" action={ACTION} className="consent-allow" data-consent-form="">
      <input type="hidden" name="category" value={category} />
      <button type="submit" name="choice" value="allow" className="button">
        {label}
      </button>
    </form>
  );
}

// Banner on the first visit (fixed at the bottom, so nothing on the page
// moves) and the settings dialog. In the layout of every public page.
export function ConsentRoot({ consent, t }: { consent: Consent; t: ConsentText }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [hidden, setHidden] = useState(false);
  const [state, setState] = useState<"" | "saving" | "error">("");
  const titleId = useId();
  const dialogTitleId = useId();

  // A new answer from the server (after refresh) shows the banner again only
  // when there is no answer.
  useEffect(() => setHidden(false), [consent.answered]);

  useEffect(() => {
    const open = (e: MouseEvent) => {
      const a = (e.target as Element | null)?.closest?.("[data-consent-open]");
      if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      dialog.current?.showModal();
    };
    const submit = async (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form?.matches?.("form[data-consent-form]")) return;
      e.preventDefault();
      const body = new FormData(form, e.submitter as HTMLButtonElement | null);
      setState("saving");
      try {
        const res = await fetch(form.action, { method: "POST", body, redirect: "manual", credentials: "same-origin" });
        // The 303 back to the page arrives as an opaque redirect.
        if (res.type !== "opaqueredirect" && !res.ok) throw new Error(String(res.status));
        setHidden(true);
        dialog.current?.close();
        setState("");
        router.refresh();
      } catch {
        setState("error");
      }
    };
    document.addEventListener("click", open);
    document.addEventListener("submit", submit);
    return () => {
      document.removeEventListener("click", open);
      document.removeEventListener("submit", submit);
    };
  }, [router]);

  const status = state ? (
    <p className={state === "error" ? "consent-status error" : "consent-status"} role="status">
      {state === "error" ? t.error : t.saving}
    </p>
  ) : null;

  return (
    <>
      {!consent.answered && !hidden ? (
        <section className="consent-banner" role="region" aria-labelledby={titleId}>
          <div className="consent-inner">
            <h2 id={titleId}>{t.title}</h2>
            <p>
              {t.text}{" "}
              <a href={`${basePath}/privacy`}>{t.privacyLink}</a>
            </p>
            <form method="post" action={ACTION} className="consent-buttons" data-consent-form="">
              <button type="submit" name="choice" value="necessary" className="button">
                {t.necessaryOnly}
              </button>
              <button type="submit" name="choice" value="all" className="button">
                {t.acceptAll}
              </button>
              <a href={PRIVACY_HREF} className="button consent-more" data-consent-open="">
                {t.settings}
              </a>
            </form>
            {status}
          </div>
        </section>
      ) : null}
      <dialog ref={dialog} className="consent-dialog" aria-labelledby={dialogTitleId}>
        <div className="consent-dialog-head">
          <h2 id={dialogTitleId}>{t.title}</h2>
          <button type="button" className="consent-x" aria-label={t.close} onClick={() => dialog.current?.close()}>
            ×
          </button>
        </div>
        <p>
          {t.text} <a href={`${basePath}/privacy`}>{t.privacyLink}</a>
        </p>
        <ConsentForm key={`${consent.maps}-${consent.steam}`} consent={consent} t={t} idPrefix="dlg" />
        {status}
      </dialog>
    </>
  );
}
