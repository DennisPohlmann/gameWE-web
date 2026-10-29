// Versions and GitHub releases for the update check (lib/updates.ts); no
// server imports, so the tests can load it.

export type Component = "web" | "collector";

export const REPOS: Record<Component, string> = {
  web: "DennisPohlmann/gameWE-web",
  collector: "DennisPohlmann/gameWE-collector",
};

export type Release = { version: string; url: string };

const SEMVER = /^v?(\d{1,6})\.(\d{1,6})\.(\d{1,6})(?:[-+][0-9A-Za-z.+-]*)?$/;

// x.y.z with an optional leading v and -suffix; null for anything else
// ("dev", "?", empty).
export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  const m = SEMVER.exec((v ?? "").trim());
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// Whether latest is a newer version than current; false when either is no
// version (a development build is never out of date).
export function isNewer(latest: string | null | undefined, current: string | null | undefined): boolean {
  const l = parseVersion(latest);
  const c = parseVersion(current);
  if (!l || !c) return false;
  for (let i = 0; i < 3; i++) if (l[i] !== c[i]) return l[i] > c[i];
  return false;
}

// The release page of a running version on github.com (the tag vX.Y.Z of
// its x.y.z), or null when it is no version (a development build).
export function releasePage(c: Component, version: string | null | undefined): string | null {
  const p = parseVersion(version);
  return p ? `https://github.com/${REPOS[c]}/releases/tag/v${p.join(".")}` : null;
}

// The release from GitHub's GET /repos/{repo}/releases/latest answer. Only
// the version and a link to the release page on github.com are taken; a
// link elsewhere is replaced by the page of the tag.
export function parseRelease(repo: string, body: unknown): Release | null {
  if (!body || typeof body !== "object") return null;
  const { tag_name: tag, html_url: url } = body as { tag_name?: unknown; html_url?: unknown };
  if (typeof tag !== "string") return null;
  const p = parseVersion(tag);
  if (!p) return null;
  const version = p.join(".");
  const page = `https://github.com/${repo}/releases/`;
  const ok = typeof url === "string" && url.startsWith(page + "tag/") && /^[A-Za-z0-9_.+-]+$/.test(url.slice(page.length + 4));
  return { version, url: ok ? (url as string) : `${page}tag/v${version}` };
}
