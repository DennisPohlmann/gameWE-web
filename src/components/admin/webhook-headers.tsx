"use client";

import { useState } from "react";
import { Icon } from "@/components/admin/icons";
import { noAutofill } from "@/lib/autofill";

// The header rows of a webhook: name and value, a plus button adds a row,
// each row can be removed. A stored value is never sent to the browser:
// its field stays empty (the server keeps the value of the same name).
// Without JavaScript the stored rows and one empty row are shown.
export type HeaderRow = { name: string; set: boolean };

export function WebhookHeaders({ initial, max, text }: { initial: HeaderRow[]; max: number; text: { name: string; value: string; stored: string; add: string; remove: string } }) {
  const [rows, setRows] = useState(() => [...initial, { name: "", set: false }].map((r, i) => ({ ...r, key: i })));
  const [next, setNext] = useState(rows.length);
  return (
    <div className="webhook-headers">
      {rows.map((r, i) => (
        <div className="webhook-header" key={r.key}>
          <input {...noAutofill} name="header_name" defaultValue={r.name} maxLength={64} placeholder={text.name} aria-label={`${text.name} ${i + 1}`} dir="ltr" />
          <input {...noAutofill} name="header_value" spellCheck={false} maxLength={2000} placeholder={r.set ? text.stored : text.value} aria-label={`${text.value} ${i + 1}`} dir="ltr" />
          <button type="button" className="button small" title={text.remove} aria-label={`${text.remove} ${i + 1}`} onClick={() => setRows(rows.filter((x) => x.key !== r.key))}>
            <Icon name="trash" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button"
        disabled={rows.length >= max}
        onClick={() => {
          setRows([...rows, { name: "", set: false, key: next }]);
          setNext(next + 1);
        }}
      >
        <Icon name="plus" />
        {text.add}
      </button>
    </div>
  );
}
