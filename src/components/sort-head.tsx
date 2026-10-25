import type { ReactNode } from "react";
import { SortTh } from "@/components/ui";

type Params = Record<string, string | number | undefined>;

// Column heads of one sortable table: th(label, key, className) gives a
// SortTh for a key of the table's allowlist (see sortState in
// lib/table-sort.ts). `page` names the table's page param when it has its
// own, so a new order starts on page 1 again.
export function sortHeads<K extends string>(
  state: { sort: K; asc: boolean },
  base: string,
  params: Params,
  names: { sortParam?: string; dirParam?: string; page?: string } = {},
) {
  const keep = names.page ? { ...params, [names.page]: undefined } : params;
  return (label: ReactNode, key: K, className = "num") => (
    <SortTh label={label} sortKey={key} className={className} current={state.sort} asc={state.asc} base={base} params={keep} sortParam={names.sortParam} dirParam={names.dirParam} />
  );
}

// Hidden fields that keep a table's order when a filter form above it is
// sent (search, select).
export function SortInputs({ keep }: { keep: Record<string, string | undefined> }) {
  return (
    <>
      {Object.entries(keep).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
    </>
  );
}
