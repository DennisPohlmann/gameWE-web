// "Add server" on a ranking's admin page: the new-server form opened with
// ?game=<code> has its ranking preset and locked, and the save returns to
// that ranking's page. The code from the URL or the form is only taken when
// it is one of the existing rankings, and the redirect is built from that
// list entry, never from the raw value (open redirect). Run the tests with
// `npm test`.
import { addParams } from "./return-to.ts";

const MAX_LEN = 64;

// The existing ranking code a raw ?game= / __ranking value names; null otherwise.
export function presetRanking(raw: unknown, codes: readonly string[]): string | null {
  if (typeof raw !== "string" || !raw || raw.length > MAX_LEN) return null;
  return codes.find((c) => c === raw) ?? null;
}

// The admin page of a ranking (code from presetRanking) at its servers card.
export function rankingServersHref(code: string, params: Record<string, string | undefined> = {}): string {
  return `${addParams(`/admin/rankings/${encodeURIComponent(code)}`, params)}#servers`;
}

// The new-server form for a ranking.
export function newServerHref(code: string): string {
  return addParams("/admin/servers/new", { game: code });
}
