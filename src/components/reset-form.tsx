"use client";

import { useRef, useState, type ReactNode } from "react";
import { noAutofill } from "@/lib/autofill";

// The form of the ranking reset (admin/reset): the button only opens a
// dialog that names the ranking and what goes; its confirm button stays
// disabled until "deleted for good" is ticked, and only it submits the form
// (confirmed=yes, checked again by resetRankingAction).
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
  understood: string;
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
  const [understood, setUnderstood] = useState(false);
  const chosen = modes.find((m) => m.value === mode) ?? modes[0];
  const name = games.find(([code]) => code === game)?.[1] ?? game;

  const open = () => {
    if (!form.current?.reportValidity()) return;
    setUnderstood(false);
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
            <option key={code} value={code}>
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
      <dialog ref={dialog} className="reset-dialog" aria-labelledby="reset-dialog-title" onClose={() => setUnderstood(false)}>
        <h2 id="reset-dialog-title">{labels.dialogTitle}</h2>
        <dl>
          <dt>{labels.dialogRanking}</dt>
          <dd>{name}</dd>
          <dt>{labels.dialogMode}</dt>
          <dd>{chosen?.title}</dd>
          <dt>{labels.dialogDeletes}</dt>
          <dd>{chosen?.deletes}</dd>
          <dt>{labels.dialogKeeps}</dt>
          <dd>{chosen?.keeps}</dd>
        </dl>
        <label className="reset-understood">
          <input type="checkbox" name="understood" value="yes" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />{" "}
          {labels.understood}
        </label>
        <div className="reset-dialog-buttons">
          <button type="button" className="button" onClick={() => dialog.current?.close()}>
            {labels.cancel}
          </button>
          <input type="hidden" name="confirmed" value={understood ? "yes" : ""} />
          <button type="submit" className="button danger" disabled={!understood}>
            {labels.confirm}
          </button>
        </div>
      </dialog>
    </form>
  );
}
