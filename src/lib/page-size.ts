// Rows per page: the steps the admin setting (gamewe_page_size) and the
// "Rows" dropdown under every table offer, at most 250.
export const PAGE_SIZES = [10, 25, 50, 100, 250] as const;

export const DEFAULT_PAGE_SIZE = 50;

// The step for a stored or old value: the largest step not above it (an old
// free value such as 30 becomes 25, 500 becomes 250); null when it is no
// positive whole number.
export function pageSizeStep(v: string | number | undefined): number | null {
  const s = String(v ?? "").trim();
  if (!/^\d{1,9}$/.test(s)) return null;
  const n = Number(s);
  if (n <= 0) return null;
  return [...PAGE_SIZES].reverse().find((p) => p <= n) ?? PAGE_SIZES[0];
}
