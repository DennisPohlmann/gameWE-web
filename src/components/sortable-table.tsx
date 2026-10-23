"use client";

import { useState, type ReactNode } from "react";

export type SortCol = { label: ReactNode; className?: string };
export type SortRow = { key: string | number; cells: ReactNode[]; values: (number | string | null)[] };

// A table sorted in the browser by a click on a column head (again: the
// other way round), for tables that are shown whole, like the weapons and
// opponents of a player. Without JavaScript it keeps the server's order.
export function SortableTable({ cols, rows, initial, className }: { cols: SortCol[]; rows: SortRow[]; initial: number; className?: string }) {
  const [by, setBy] = useState(initial);
  const [asc, setAsc] = useState(false);
  const sorted = [...rows].sort((a, b) => {
    const x = a.values[by];
    const y = b.values[by];
    if (x === y) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const d = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return asc ? d : -d;
  });
  const click = (i: number) => {
    if (i === by) setAsc(!asc);
    else {
      setBy(i);
      // Names A to Z first, numbers highest first.
      setAsc(typeof rows[0]?.values[i] === "string");
    }
  };
  return (
    <table className={className}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} className={c.className} aria-sort={i === by ? (asc ? "ascending" : "descending") : undefined}>
              <button type="button" className={i === by ? "sort active" : "sort"} onClick={() => click(i)}>
                {c.label}
                {i === by ? (asc ? " ▲" : " ▼") : ""}
              </button>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.key}>
            {r.cells.map((c, i) => (
              <td key={i} className={cols[i].className}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
