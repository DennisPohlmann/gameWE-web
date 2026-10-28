// ADMIN_SECRET signs the admin sessions, so a value anyone can read (the
// placeholders of the docs and the quick start, "change-me...") or a
// repeated pattern would let anyone forge a session. Such values count as
// not set: the admin area stays locked.

export const MIN_ADMIN_SECRET = 32;

// "change-me", "change_me", "changeme", "CHANGE ME", ...
const PLACEHOLDER = /change[\s_-]*me/i;

export function adminSecretProblem(s: string): "short" | "placeholder" | "weak" | null {
  if (s.length < MIN_ADMIN_SECRET) return "short";
  if (PLACEHOLDER.test(s)) return "placeholder";
  // openssl rand -hex 32 has 16 different characters; aaaa... or 1212... is no secret.
  if (new Set(s).size < 8) return "weak";
  return null;
}
