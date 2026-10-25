// The live feeds (events of a ranking or a player as JSON) are asked every
// few seconds by every open page. Mostly nothing has happened since the
// last ask, so the page sends the second of the newest event it knows and
// how many events of that second it knows (`?since=<unix seconds>&seen=<n>`)
// and the feed answers with 204 and no body when it has nothing newer; the
// rows' flags are not looked up then either. Shared by the feeds and the
// live boxes (no server-only code here).

// The newest second among `rows` and how many rows have it; {0, 0} without
// rows.
export function newestOf(rows: { ts: number }[]): { ts: number; n: number } {
  const ts = rows.reduce((m, e) => Math.max(m, e.ts), 0);
  return { ts, n: ts > 0 ? rows.filter((e) => e.ts === ts).length : 0 };
}

// `cur` once the rows `add` are known as well: a newer second starts the
// count afresh, the same second adds to it, older ones change nothing.
export function newerWith(cur: { ts: number; n: number }, add: { ts: number }[]): { ts: number; n: number } {
  const a = newestOf(add);
  if (a.ts > cur.ts) return a;
  if (a.ts === cur.ts) return { ts: cur.ts, n: cur.n + a.n };
  return cur;
}

// The `since` and `seen` of a feed URL: a unix time in seconds (else 0:
// everything) and the count of its second (else 0).
export function sinceParam(url: string): { since: number; seen: number } {
  const q = new URL(url).searchParams;
  const num = (v: string | null) => (v !== null && /^\d{1,10}$/.test(v) ? Number(v) : 0);
  return { since: num(q.get("since")), seen: num(q.get("seen")) };
}

// True when `rows` hold nothing newer than `since` and no more than `seen`
// rows of that second (the page knows them all already).
export function nothingNew(rows: { ts: number }[], { since, seen }: { since: number; seen: number }): boolean {
  if (since <= 0) return false;
  if (rows.some((r) => r.ts > since)) return false;
  return rows.filter((r) => r.ts === since).length <= seen;
}

// The answer of a feed that has nothing new.
export function noContent(): Response {
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
}
