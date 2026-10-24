"use client";

import { useState, type DragEvent } from "react";
import { LINK_SLOTS, type LinkProblem, type TabId, homeValue, linkProblem } from "@/lib/header-links";
import type { AdminDict } from "@/lib/admin-i18n";
import { noAutofill } from "@/lib/autofill";

// The header tabs of Admin → Settings as one ordered list: move with the
// arrows or by dragging, rename Home and the own links, add and remove own
// links. Everything is sent with the settings form: the order as
// gamewe_header_order, Home and each own link as <key>__label/<key>__url.
// An own link that was removed sends nothing, so the server clears its slot.
// Without JavaScript the list is rendered as stored and saves unchanged.

export type EditorRow = {
  id: TabId;
  kind: "home" | "builtin" | "sourcebans" | "custom";
  // Built-in tabs: the name in the admin's language. Home and own links:
  // the stored name and address.
  label: string;
  url: string;
  // SourceBans while no address is set, own links with an empty slot: kept
  // in the order but not listed.
  hidden: boolean;
};

export type HeaderLinksText = Pick<
  AdminDict,
  | "hlPosition"
  | "hlUp"
  | "hlDown"
  | "hlDrag"
  | "hlBuiltin"
  | "hlBuiltinHint"
  | "hlSourcebans"
  | "hlSourcebansHint"
  | "hlHome"
  | "hlHomeHint"
  | "hlCustom"
  | "hlLabel"
  | "hlLabelPlaceholder"
  | "hlUrl"
  | "hlUrlPlaceholder"
  | "hlUrlHint"
  | "hlAdd"
  | "hlFull"
  | "hlNone"
  | "hlRemove"
  | "hlRemoveConfirm"
  | "hlErrLabel"
  | "hlErrUrl"
  | "hlErrBoth"
  | "hlErrLong"
  | "hlErrServer"
  | "hlUnnamed"
>;

// Same as fill() in lib/i18n.ts, which is server-only.
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ""));

const fieldKey = (id: TabId) => (id === "home" ? "gamewe_header_home" : `gamewe_link_${id.slice(4)}`);

export function HeaderLinksEditor({ initial, homeName, text, badField }: { initial: EditorRow[]; homeName: string; text: HeaderLinksText; badField?: string }) {
  const [rows, setRows] = useState(initial);
  const [dragId, setDragId] = useState<TabId | null>(null);
  const [focusId, setFocusId] = useState<TabId | null>(null);
  const visible = rows.filter((r) => !r.hidden);
  const customCount = visible.filter((r) => r.kind === "custom").length;

  const update = (id: TabId, patch: Partial<EditorRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // Swap with the next listed neighbour; hidden rows keep their place.
  const move = (id: TabId, dir: -1 | 1) =>
    setRows((rs) => {
      const shown = rs.filter((r) => !r.hidden);
      const i = shown.findIndex((r) => r.id === id);
      const other = shown[i + dir];
      if (!other) return rs;
      const a = rs.findIndex((r) => r.id === id);
      const b = rs.findIndex((r) => r.id === other.id);
      const next = [...rs];
      [next[a], next[b]] = [next[b], next[a]];
      return next;
    });

  // Dropped on `target`: the dragged row takes its place, the rest shift.
  const dropOn = (target: TabId) =>
    setRows((rs) => {
      if (!dragId || dragId === target) return rs;
      const from = rs.findIndex((r) => r.id === dragId);
      const to = rs.findIndex((r) => r.id === target);
      const next = [...rs];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });

  const add = () => {
    const free = rows.find((r) => r.kind === "custom" && r.hidden);
    if (!free) return;
    // A new link goes to the end of the list.
    setRows((rs) => [...rs.filter((r) => r.id !== free.id), { ...free, hidden: false, label: "", url: "" }]);
    setFocusId(free.id);
  };

  const remove = (r: EditorRow) => {
    if ((r.label || r.url) && !window.confirm(fill(text.hlRemoveConfirm, { name: r.label || r.url }))) return;
    update(r.id, { hidden: true, label: "", url: "" });
  };

  const problemText: Record<LinkProblem, string> = { label: text.hlErrLabel, url: text.hlErrUrl, both: text.hlErrBoth, long: text.hlErrLong };

  return (
    <div className="hl-editor">
      <input type="hidden" name="gamewe_header_order" value={rows.map((r) => r.id).join(",")} />
      <ol className="hl-list">
        {visible.map((r, i) => {
          const name = r.kind === "custom" ? r.label || text.hlUnnamed : r.kind === "home" ? r.label || homeName : r.label;
          const editable = r.kind === "home" || r.kind === "custom";
          const key = editable ? fieldKey(r.id) : "";
          const problem =
            r.kind === "custom" ? linkProblem(r.label, r.url) : r.kind === "home" && homeValue(r.label, r.url) === null ? (r.label.length > 60 || r.label.includes("|") ? "long" : "both") : null;
          const serverBad = editable && badField === key;
          return (
            <li
              key={r.id}
              className={`hl-row${dragId === r.id ? " dragging" : ""}${problem || serverBad ? " invalid" : ""}`}
              onDragOver={(e: DragEvent) => {
                if (dragId) e.preventDefault();
              }}
              onDrop={(e: DragEvent) => {
                e.preventDefault();
                dropOn(r.id);
                setDragId(null);
              }}
            >
              <div className="hl-head">
                <span
                  className="hl-grip"
                  draggable
                  title={text.hlDrag}
                  aria-hidden="true"
                  onDragStart={(e: DragEvent) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", r.id);
                    setDragId(r.id);
                  }}
                  onDragEnd={() => setDragId(null)}
                >
                  ⠿
                </span>
                <span className="hl-pos" title={fill(text.hlPosition, { n: i + 1 })}>
                  {i + 1}
                </span>
                <strong className="hl-name">{name}</strong>
                {r.kind === "builtin" || r.kind === "sourcebans" ? (
                  <span className="hl-badge" title={r.kind === "builtin" ? text.hlBuiltinHint : text.hlSourcebansHint}>
                    🔒 {text.hlBuiltin}
                  </span>
                ) : (
                  <span className="hl-badge hl-badge-edit">{r.kind === "home" ? text.hlHome : text.hlCustom}</span>
                )}
                <span className="hl-actions">
                  <button type="button" className="button small" onClick={() => move(r.id, -1)} disabled={i === 0} aria-label={fill(text.hlUp, { name })} title={fill(text.hlUp, { name })}>
                    ↑
                  </button>
                  <button
                    type="button"
                    className="button small"
                    onClick={() => move(r.id, 1)}
                    disabled={i === visible.length - 1}
                    aria-label={fill(text.hlDown, { name })}
                    title={fill(text.hlDown, { name })}
                  >
                    ↓
                  </button>
                  {r.kind === "custom" ? (
                    <button type="button" className="button small danger" onClick={() => remove(r)} aria-label={fill(text.hlRemove, { name })}>
                      ✕
                    </button>
                  ) : null}
                </span>
              </div>
              {editable ? (
                <div className="hl-fields">
                  <label>
                    {text.hlLabel}
                    <input
                      {...noAutofill}
                      name={`${key}__label`}
                      value={r.label}
                      onChange={(e) => update(r.id, { label: e.target.value })}
                      placeholder={r.kind === "home" ? homeName : text.hlLabelPlaceholder}
                      maxLength={60}
                      autoFocus={focusId === r.id}
                      aria-invalid={problem === "label" || problem === "long" || serverBad || undefined}
                    />
                  </label>
                  <label>
                    {text.hlUrl}
                    <input
                      {...noAutofill}
                      name={`${key}__url`}
                      value={r.url}
                      onChange={(e) => update(r.id, { url: e.target.value })}
                      placeholder={r.kind === "home" ? "/" : text.hlUrlPlaceholder}
                      maxLength={190}
                      inputMode="url"
                      aria-invalid={problem === "url" || problem === "both" || serverBad || undefined}
                    />
                  </label>
                  <small className="muted hl-hint">
                    {r.kind === "home" ? fill(text.hlHomeHint, { name: homeName }) : text.hlUrlHint} <code>{key}</code>
                  </small>
                  {problem ? (
                    <small className="hl-error" role="alert">
                      {problemText[problem]}
                    </small>
                  ) : serverBad ? (
                    <small className="hl-error" role="alert">
                      {text.hlErrServer}
                    </small>
                  ) : null}
                </div>
              ) : (
                <small className="muted hl-hint">{r.kind === "builtin" ? text.hlBuiltinHint : text.hlSourcebansHint}</small>
              )}
            </li>
          );
        })}
      </ol>
      {customCount ? null : <p className="muted">{text.hlNone}</p>}
      <p>
        <button type="button" className="button" onClick={add} disabled={customCount >= LINK_SLOTS}>
          + {text.hlAdd}
        </button>{" "}
        {customCount >= LINK_SLOTS ? <small className="muted">{fill(text.hlFull, { n: LINK_SLOTS })}</small> : null}
      </p>
    </div>
  );
}
