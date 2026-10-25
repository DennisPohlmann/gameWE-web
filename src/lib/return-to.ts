// The admin list an edit page returns to (ranking, search, state, page, rows and order of
// /admin/<entity>), carried as ?returnTo= through the edit page, its forms
// and the redirects of the server actions. Only the list of the same entity
// with its known parameters is accepted, so the value cannot redirect
// anywhere else (open redirect). Run the tests with `npm test`.

// The list parameters kept; anything else in returnTo is dropped. sort and
// dir are checked again by the list against the entity's columns.
const LIST_PARAMS = ["game", "q", "status", "page", "rows", "sort", "dir"] as const;
const MAX_LEN = 512;

// Appends query parameters to a relative href (undefined and "" are left out).
export function addParams(href: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${href}${href.includes("?") ? "&" : "?"}${s}` : href;
}

// The list URL of an entity with its filters (page 1 and the default rows
// are left out by the caller).
export function listHref(entity: string, params: Partial<Record<(typeof LIST_PARAMS)[number], string | number | undefined>>): string {
  return addParams(`/admin/${entity}`, params);
}

// The validated list URL from a returnTo value; the plain list otherwise.
export function safeReturnTo(raw: unknown, entity: string): string {
  const plain = `/admin/${entity}`;
  if (typeof raw !== "string" || raw.length > MAX_LEN) return plain;
  // Relative paths only: no scheme, no "//host", no backslashes or control characters.
  if (!raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return plain;
  let url: URL;
  try {
    url = new URL(raw, "http://returnto.invalid");
  } catch {
    return plain;
  }
  if (url.origin !== "http://returnto.invalid" || url.pathname !== plain) return plain;
  const keep: Record<string, string> = {};
  for (const k of LIST_PARAMS) {
    const v = url.searchParams.get(k)?.trim().slice(0, 64);
    if (v) keep[k] = v;
  }
  return listHref(entity, keep);
}

// An edit-page href that remembers the list (nothing added for the plain list).
export function withReturnTo(href: string, returnTo: string, entity: string): string {
  return returnTo === `/admin/${entity}` ? href : addParams(href, { returnTo });
}
