"use client";

import { useState, type ReactNode } from "react";
import { sortRows } from "@/lib/table-sort";

// noSort: a column whose order would only repeat another one (a share bar
// next to its count) or has nothing to sort by.
export type SortCol = { label: ReactNode; className?: string; noSort?: boolean };
// className: of the row (e.g. the selected one).
export type SortRow = { key: string | number; cells: ReactNode[]; values: (number | string | null)[]; className?: string };

// A table sorted in the browser by a click on a column head (again: the
// other way round), for tables that are shown whole, like the weapons and
// opponents of a player. Without JavaScript it keeps the server's order.
// The look and the rules are those of the server-sorted tables (SortTh):
// arrow and underline on the sorted head, aria-sort, empty values last.
// initial -1 keeps the given order until a head is clicked.
export function SortableTable({ cols, rows, initial, initialAsc = false, className }: { cols: SortCol[]; rows: SortRow[]; initial: number; initialAsc?: boolean; className?: string }) {
  const [by, setBy] = useState(initial);
  const [asc, setAsc] = useState(initialAsc);
  const values = Object.fromEntries(cols.map((_, i) => [String(i), (r: SortRow) => r.values[i]]));
  const sorted = by < 0 ? rows : sortRows(rows, values, String(by), asc);
  const click = (i: number) => {
    if (i === by) setAsc(!asc);
    else {
      setBy(i);
      // Names A to Z first, numbers highest first.
      setAsc(typeof rows.find((r) => r.values[i] !== null)?.values[i] === "string");
    }
  };
  return (
    <table className={className}>
      <thead>
        <tr>
          {cols.map((c, i) => (
            <th key={i} className={c.className} aria-sort={i === by ? (asc ? "ascending" : "descending") : undefined}>
              {c.noSort ? (
                c.label
              ) : (
                <button type="button" className={i === by ? "sort active" : "sort"} onClick={() => click(i)}>
                  {c.label}
                  {i === by ? (asc ? " ▲" : " ▼") : ""}
                </button>
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.key} className={r.className}>
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
