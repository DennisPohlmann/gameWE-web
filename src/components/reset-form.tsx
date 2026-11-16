"use client";

import { useRef, useState, type ReactNode } from "react";
import { noAutofill } from "@/lib/autofill";

// The form of the ranking reset (admin/reset): the button only opens a
// dialog that names the ranking and what goes; its confirm button stays
// disabled until the ranking's code is typed (as every dangerous step of the
// admin area, components/admin/confirm-button.tsx), and only it submits the
// form (confirmed=yes, checked again by resetRankingAction).
export type ResetModeText = { value: string; title: string; deletes: string; keeps: string };
export type ResetFormLabels = {
  ranking: string;
  mode: string;
  submit: string;
  dialogTitle: string;
  dialogRanking: string;
  dialogMode: string;
  dialogDeletes: string;
  dialogKeeps: string;
  typeCode: string;
  confirm: string;
  cancel: string;
};

export function ResetForm({
  action,
  games,
  modes,
  labels,
  game: initialGame,
  children,
}: {
  action: (form: FormData) => Promise<void>;
  games: [string, string][];
  modes: ResetModeText[];
  labels: ResetFormLabels;
  game?: string;
  children?: ReactNode; // help texts above the fields
}) {
  const form = useRef<HTMLFormElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [game, setGame] = useState(initialGame ?? "");
  const [mode, setMode] = useState(modes[0]?.value ?? "");
  const [typed, setTyped] = useState("");
  const understood = game !== "" && typed.trim().toLowerCase() === game.toLowerCase();
  const chosen = modes.find((m) => m.value === mode) ?? modes[0];
  const name = games.find(([code]) => code === game)?.[1] ?? game;

  const open = () => {
    if (!form.current?.reportValidity()) return;
    setTyped("");
    dialog.current?.showModal();
  };

  return (
    <form ref={form} action={action} className="form settings-grid">
      {children}
      <label>
        {labels.ranking}
        <select {...noAutofill} name="game" value={game} onChange={(e) => setGame(e.target.value)} required>
          <option value="">-</option>
          {games.map(([code, n]) => (
            <option key={code} value={code} dir="auto">
              {n}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="reset-mode">
        <legend>{labels.mode}</legend>
        {modes.map((m) => (
          <label key={m.value}>
            <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} />
            <span>
              <b>{m.title}</b>: {m.deletes} {m.keeps}
            </span>
          </label>
        ))}
      </fieldset>
      <div>
        <button type="button" className="button danger" onClick={open}>
          {labels.submit}
        </button>
      </div>
      <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-dialog-title" onClose={() => setTyped("")}>
        <h2 id="reset-dialog-title">{labels.dialogTitle}</h2>
        <dl>
          <dt>{labels.dialogRanking}</dt>
          <dd><bdi>{name}</bdi></dd>
          <dt>{labels.dialogMode}</dt>
          <dd>{chosen?.title}</dd>
          <dt>{labels.dialogDeletes}</dt>
          <dd>{chosen?.deletes}</dd>
          <dt>{labels.dialogKeeps}</dt>
          <dd>{chosen?.keeps}</dd>
        </dl>
        <label className="confirm-typed">
          <span>{labels.typeCode.split("{w}").flatMap((p, i) => (i ? [<b key={i}>{game}</b>, p] : [p]))}</span>
          <input {...noAutofill} name="typed" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} dir="ltr" />
        </label>
        <div className="reset-dialog-buttons">
          <button type="button" className="button" onClick={() => dialog.current?.close()}>
            {labels.cancel}
          </button>
          <input type="hidden" name="confirmed" value={understood ? "yes" : ""} />
          <button type="submit" className="button danger solid" disabled={!understood}>
            {labels.confirm}
          </button>
        </div>
      </dialog>
    </form>
  );
}
