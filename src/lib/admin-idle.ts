// Automatic sign-out after a time without activity in the admin area
// (Settings → Admin area). On by default with 10 minutes; "off" turns it off.
// The session cookie carries the time of the last activity (lib/auth.ts);
// the admin pages report activity at most once a minute and sign out when
// the time is up (components/admin/idle-logout.tsx, admin/session/route.ts).

export const IDLE_DEFAULT_MINUTES = 10;
export const IDLE_MIN_MINUTES = 1;
export const IDLE_MAX_MINUTES = 1440;
// How often an active page renews the time in the cookie.
export const IDLE_TOUCH_MS = 60_000;

// How often a page with a sign-out after `limit` milliseconds renews the
// time: once a minute, for short times a quarter of the time, so that
// activity always reaches the server before the time in the cookie runs out.
export function touchEvery(limit: number): number {
  return Math.max(1_000, Math.min(IDLE_TOUCH_MS, Math.floor(limit / 4)));
}

// Minutes until the sign-out from the two options; 0 = off. A missing or
// broken value is the default, never "off".
export function idleMinutes(enabled: string | undefined, minutes: string | undefined): number {
  if (enabled?.trim() === "0") return 0;
  const n = Number(minutes?.trim());
  if (!Number.isInteger(n) || n < IDLE_MIN_MINUTES || n > IDLE_MAX_MINUTES) return IDLE_DEFAULT_MINUTES;
  return n;
}

// Milliseconds left before the sign-out; Infinity when it is off. A time in
// the future (clock skew, a forged value cannot pass the signature) counts
// as now.
export function idleLeft(lastActivity: number, minutes: number, now: number): number {
  if (minutes <= 0) return Infinity;
  const last = Number.isFinite(lastActivity) ? Math.min(lastActivity, now) : 0;
  return Math.max(0, last + minutes * 60_000 - now);
}
