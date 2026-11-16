// The page's address for <link rel="canonical">: src/proxy.ts hands the
// path and query to the layout in this header. Only the query parameters
// that choose what a page shows stay; sorting, rows per page, search words
// and display toggles are the same page for search engines.
export const PATH_HEADER = "x-gamewe-path";

const KEEP = ["view", "award", "rank", "class", "tab", "type", "valuecountry", "valuestate", "valuecity", "period", "month", "date", "page"];

export function canonicalPath(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
  let u: URL;
  try {
    u = new URL(raw, "http://x");
  } catch {
    return null;
  }
  const out = new URLSearchParams();
  for (const k of KEEP) {
    const v = u.searchParams.get(k);
    if (v && !(k === "page" && v === "1")) out.set(k, v);
  }
  return u.pathname + (out.size ? `?${out}` : "");
}
