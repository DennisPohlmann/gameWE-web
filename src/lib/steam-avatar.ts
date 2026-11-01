// The hosts Steam serves avatars from. Only pictures from these are shown,
// redirected to (/avatar) or fetched by the server (banners): the URL comes
// from Steam's answer, and the privacy page lists exactly these hosts
// (lib/privacy-inventory.ts). Pure, for the tests.

export const STEAM_AVATAR_HOSTS = ["avatars.steamstatic.com", "avatars.fastly.steamstatic.com", "avatars.akamai.steamstatic.com"];

// The URL if it is https on one of those hosts (default port), else null.
export function steamAvatarUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" && !url.port && !url.username && !url.password && STEAM_AVATAR_HOSTS.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}
