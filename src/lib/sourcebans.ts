// The address of a SourceBans / SourceBans++ installation (Settings → Bans,
// hlstats_Options gamewe_sourcebans_url), for the link to its ban list and
// the badges' search links. The site does not read the list itself: the
// collector's bans-sync job reads the whole public list and stores its
// running bans in hlstats_Bans (lib/bans.ts).

// The base address from the setting: http(s) only, no user/password, ends with "/".
export function sourcebansBase(v: string | undefined): string {
  const s = (v ?? "").trim();
  if (!s || (/^[a-z][a-z0-9+.-]*:\/\//i.test(s) && !/^https?:\/\//i.test(s))) return "";
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if ((u.protocol !== "http:" && u.protocol !== "https:") || u.username || u.password) return "";
    u.search = "";
    u.hash = "";
    u.pathname = u.pathname.replace(/index\.php$/i, "").replace(/\/?$/, "/");
    return u.toString();
  } catch {
    return "";
  }
}
