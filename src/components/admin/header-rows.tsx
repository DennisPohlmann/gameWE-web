"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { Icon } from "./icons";

// The FastDL headers as a secret (SecretControl): one masked "Name: value"
// row each, sent under the same name (lib/fastdl-access.ts joins them), with
// a plus button for one more row and a remove button on every row. Empty rows
// keep what is stored, as with any secret. load: the stored headers, fetched
// on the first show while all rows are empty and put into the rows; once they
// are, emptying every row removes them on save.
export function HeaderRows({
  id,
  name,
  max,
  load,
  text,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "defaultValue"> & {
  id: string;
  name: string;
  max: number;
  load?: () => Promise<string>;
  text: { show: string; hide: string; add: string; remove: string; row: string };
}) {
  const next = useRef(1);
  const [rows, setRows] = useState([{ k: 0, v: "" }]);
  const [loaded, setLoaded] = useState(false);
  const [shown, setShown] = useState(false);
  const [busy, setBusy] = useState(false);
  const row = (v: string) => ({ k: next.current++, v });
  const toggle = async () => {
    if (!shown && load && rows.every((r) => !r.v)) {
      setBusy(true);
      try {
        const stored = (await load()).split("\n").filter(Boolean);
        if (stored.length) {
          setRows(stored.map(row));
          setLoaded(true);
        }
      } finally {
        setBusy(false);
      }
    }
    setShown((s) => !s);
  };
  const remove = (k: number) => setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.k !== k) : [row("")]));
  const off = input.disabled || busy;
  return (
    <span className="header-rows">
      {rows.map((r, i) => (
        <span className="header-row" key={r.k}>
          <span className="reveal">
            <input
              {...input}
              id={i ? `${id}-${r.k}` : id}
              name={name}
              aria-label={i ? text.row.replace("{n}", String(i + 1)) : undefined}
              placeholder={i ? undefined : input.placeholder}
              type={shown ? "text" : "password"}
              value={r.v}
              onChange={(e) => setRows((rs) => rs.map((x) => (x.k === r.k ? { ...x, v: e.target.value } : x)))}
            />
            <button type="button" className="reveal-btn" aria-label={shown ? text.hide : text.show} title={shown ? text.hide : text.show} aria-pressed={shown} aria-busy={busy || undefined} disabled={off} onClick={toggle}>
              <Icon name={shown ? "eyeOff" : "eye"} />
            </button>
          </span>
          <button type="button" className="button small header-remove" aria-label={`${text.remove} ${i + 1}`} title={text.remove} disabled={off || (rows.length === 1 && !r.v)} onClick={() => remove(r.k)}>
            <Icon name="trash" />
          </button>
        </span>
      ))}
      {/* The stored headers were loaded and every row is now empty: remove them. */}
      {loaded && rows.every((r) => !r.v.trim()) ? <input type="hidden" name={`${name}__clear`} value="1" /> : null}
      <button type="button" className="button small header-add" disabled={off || rows.length >= max} onClick={() => setRows((rs) => [...rs, row("")])}>
        <Icon name="plus" />
        {text.add}
      </button>
    </span>
  );
}
