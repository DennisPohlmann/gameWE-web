// Consent of a visitor to content that their browser would load from other
// hosts (and so hand them the visitor's IP address). Kept in the necessary
// cookie gamewe_consent as "<version>.<categories>", e.g. "1.maps-steam" or
// "1." (only necessary). A cookie of another version counts as no answer,
// so the banner asks again after the categories changed.
//
// Pure functions without "server-only": the consent route, the layout, the
// components and the tests all use them (lib/consent-server.ts reads the
// request's cookie).

export const CONSENT_COOKIE = "gamewe_consent";
export const CONSENT_VERSION = 1;
// Twelve months, then the banner asks again.
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;

// Optional categories. "maps": map tiles (OpenStreetMap, CARTO, ...) on the
// player maps. "steam": Steam profile pictures from Steam's image servers.
export const CONSENT_CATEGORIES = ["maps", "steam"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

// answered: false while the visitor has not chosen (banner shown, nothing
// optional allowed).
export type Consent = { answered: boolean } & Record<ConsentCategory, boolean>;

export const NO_CONSENT: Consent = { answered: false, maps: false, steam: false };

export function isCategory(v: unknown): v is ConsentCategory {
  return typeof v === "string" && (CONSENT_CATEGORIES as readonly string[]).includes(v);
}

export function parseConsent(raw: string | undefined | null): Consent {
  const m = /^(\d{1,3})\.([a-z-]{0,40})$/.exec(raw ?? "");
  if (!m || Number(m[1]) !== CONSENT_VERSION) return NO_CONSENT;
  const parts = m[2] ? m[2].split("-") : [];
  if (!parts.every(isCategory)) return NO_CONSENT;
  return { answered: true, maps: parts.includes("maps"), steam: parts.includes("steam") };
}

export function serializeConsent(allowed: Iterable<ConsentCategory>): string {
  const set = new Set(allowed);
  return `${CONSENT_VERSION}.${CONSENT_CATEGORIES.filter((c) => set.has(c)).join("-")}`;
}

// The categories chosen in the consent form (banner, settings dialog,
// privacy page): "all", "necessary", or "save" with one checkbox per
// category; "allow" adds one category (button "Always allow" on a
// placeholder) to what is already allowed. null for anything else.
export function chosenCategories(form: { get(name: string): unknown }, current: Consent): ConsentCategory[] | null {
  const choice = form.get("choice");
  if (choice === "all") return [...CONSENT_CATEGORIES];
  if (choice === "necessary") return [];
  if (choice === "save") return CONSENT_CATEGORIES.filter((c) => form.get(c) === "1");
  if (choice === "allow") {
    const add = form.get("category");
    if (!isCategory(add)) return null;
    return CONSENT_CATEGORIES.filter((c) => c === add || current[c]);
  }
  return null;
}

// Where a Steam picture may come from: the given address only with consent,
// otherwise null (the caller shows its local placeholder).
export function externalImage(consent: Consent, url: string | null | undefined): string | null {
  return consent.steam && url ? url : null;
}

// Where to go back to after saving: the page the form was on, same host
// only, as path and query; else the site's start page. A path starting
// with // or /\ would be read as another host ("//evil.example/x").
export function backPath(referer: string | null, host: string | null, fallback: string): string {
  if (!referer || !host) return fallback;
  try {
    const u = new URL(referer);
    if (u.host !== host || !/^https?:$/.test(u.protocol) || /^\/[\/\\]/.test(u.pathname)) return fallback;
    return u.pathname + u.search;
  } catch {
    return fallback;
  }
}

// A POST from another site must not change the choice. Browsers send
// Sec-Fetch-Site and Origin on a form POST; Origin is "null" under a
// no-referrer policy, so Sec-Fetch-Site decides first. Without either the
// request is refused.
export function sameOrigin(origin: string | null, host: string | null, fetchSite?: string | null): boolean {
  if (fetchSite) return fetchSite === "same-origin";
  if (!origin || origin === "null" || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
