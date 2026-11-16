import { createHash } from "node:crypto";

// What an admin may do. Level 100 (full admin) may do everything and is the
// only one who manages admins and their rights. A level 80 admin has the
// rights stored for them (hlstats_Options gamewe_perms_<hash>, set on the
// admin's page or with the admin API); without a stored row they have what
// level 80 always had (LEVEL80_DEFAULT), so existing admins keep their
// rights. No database access, so `npm test` can load it.

export const PERMS = [
  "rankings.view",
  "rankings.edit",
  "servers.view",
  "servers.edit",
  "players.view",
  "players.edit",
  "players.erase",
  "definitions.view",
  "definitions.edit",
  "resets",
  "chat.view",
  "ips.view",
  "jobs.view",
  "settings.view",
  "settings.edit",
  "settings.protected",
] as const;
export type Perm = (typeof PERMS)[number];
// "admin": only level 100 (managing admins); null: every admin.
export type Need = Perm | "admin" | null;

export const LEVEL_FULL = 100;

// What level 80 could do before rights existed.
export const LEVEL80_DEFAULT: Perm[] = ["rankings.view", "players.view", "players.edit", "definitions.view", "definitions.edit", "chat.view", "ips.view", "jobs.view", "settings.view", "settings.edit"];

// A right that needs another one to be of use: changing needs seeing.
const IMPLIES: Partial<Record<Perm, Perm[]>> = {
  "rankings.edit": ["rankings.view"],
  "servers.edit": ["servers.view"],
  "players.edit": ["players.view"],
  "players.erase": ["players.view"],
  "definitions.edit": ["definitions.view"],
  resets: ["rankings.view"],
  "settings.edit": ["settings.view"],
  "settings.protected": ["settings.view", "settings.edit"],
};

export const isPerm = (v: unknown): v is Perm => typeof v === "string" && (PERMS as readonly string[]).includes(v);

// Known rights with what they imply, in the order of PERMS.
export function normalizePerms(list: readonly string[]): Perm[] {
  const set = new Set<Perm>();
  for (const p of list) if (isPerm(p)) [p, ...(IMPLIES[p] ?? [])].forEach((x) => set.add(x));
  return PERMS.filter((p) => set.has(p));
}

// The stored value (comma-separated; at most ~190 characters, the column has 255).
export const permsValue = (perms: readonly Perm[]) => normalizePerms(perms).join(",");

// A stored value; no row (null): the old level 80 rights. A role reference
// ("role:<id>") is no right of its own: the role's rights come from its row.
export const parsePerms = (raw: string | null | undefined): Perm[] => (raw == null ? [...LEVEL80_DEFAULT] : roleOf(raw) !== null ? [] : normalizePerms(raw.split(",").map((s) => s.trim())));

// The option row of a user's rights. Not bound to the exact spelling, as the
// database may compare names without case or trailing spaces.
const userHash = (user: string) => createHash("sha256").update(user.trim().toLowerCase()).digest("hex").slice(0, 32);
export const permsKey = (user: string) => `gamewe_perms_${userHash(user)}`;
// The display name an admin gives themselves (My account): shown in the
// account menu and the user list; the sign-in stays the user name.
export const nameKey = (user: string) => `gamewe_name_${userHash(user)}`;

export type PermUser = { acclevel: number; perms?: readonly Perm[] };

export const isFullAdmin = (u: PermUser) => Number(u.acclevel) >= LEVEL_FULL;

export function allowed(u: PermUser, need: Need): boolean {
  if (isFullAdmin(u)) return true;
  if (need === null) return true;
  if (need === "admin") return false;
  return !!u.perms?.includes(need);
}

// Every right with whether this admin has it (the menu, the pages).
export const permMap = (u: PermUser) => Object.fromEntries([...PERMS, "admin" as const].map((p) => [p, allowed(u, p)])) as Record<Perm | "admin", boolean>;

// The effective rights of an admin (level 100: all).
export const effectivePerms = (u: PermUser): Perm[] => (isFullAdmin(u) ? [...PERMS] : normalizePerms(u.perms ?? []));

// Ready-made sets of rights for the admin's page (a click checks the boxes).
export const ROLE_PRESETS: { id: string; perms: Perm[] }[] = [
  { id: "readonly", perms: ["rankings.view", "servers.view", "players.view", "definitions.view", "jobs.view", "settings.view"] },
  { id: "moderator", perms: ["rankings.view", "players.view", "players.edit", "chat.view", "ips.view"] },
  { id: "rankings", perms: ["rankings.edit", "servers.edit", "definitions.edit", "players.view", "resets", "jobs.view"] },
  { id: "classic", perms: LEVEL80_DEFAULT },
];

// The rights by area, in the order of the admin's page (texts: PERM_T).
export const PERM_GROUPS: { id: "rankings" | "servers" | "players" | "definitions" | "moderation" | "collector" | "settings"; perms: Perm[] }[] = [
  { id: "rankings", perms: ["rankings.view", "rankings.edit", "resets"] },
  { id: "servers", perms: ["servers.view", "servers.edit"] },
  { id: "players", perms: ["players.view", "players.edit", "players.erase"] },
  { id: "definitions", perms: ["definitions.view", "definitions.edit"] },
  { id: "moderation", perms: ["chat.view", "ips.view"] },
  { id: "collector", perms: ["jobs.view"] },
  { id: "settings", perms: ["settings.view", "settings.edit", "settings.protected"] },
];

// ---------------------------------------------------------------- roles
// An admin role: a name and a set of rights, defined once (Settings →
// Admin roles or the API) and given to restricted admins. An admin with a
// role has exactly the role's rights, which change with the role; without
// one the admin keeps rights of their own as before. Stored in
// hlstats_Options:
//   gamewe_role_<id>     "<rights>|<name>" (rights as in permsValue)
//   gamewe_perms_<hash>  "role:<id>" instead of the admin's own rights
// An older version reads "role:<id>" as no rights at all, never as more.

export type Role = { id: string; name: string; perms: Perm[] };

export const ROLE_REF = "role:";
export const ROLE_PREFIX = "gamewe_role_";
export const ROLE_MAX = 50;
export const isRoleId = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9]{8}$/.test(v);
export const roleKey = (id: string) => `${ROLE_PREFIX}${id}`;

// The role an admin's stored rights point to, or null for own rights.
export function roleOf(raw: string | null | undefined): string | null {
  if (!raw?.startsWith(ROLE_REF)) return null;
  const id = raw.slice(ROLE_REF.length).trim();
  return isRoleId(id) ? id : null;
}

// A role's name (and an admin's display name): 1 to 40 characters, no
// control characters.
export function roleName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.trim().replace(/\s+/g, " ");
  return n.length >= 1 && n.length <= 40 && !/[\u0000-\u001f\u007f]/.test(n) ? n : null;
}

export const roleValue = (name: string, perms: readonly Perm[]) => `${permsValue(perms)}|${name}`;

export function parseRole(id: string, raw: string | null | undefined): Role | null {
  if (!isRoleId(id) || !raw) return null;
  const i = raw.indexOf("|");
  const name = roleName(i < 0 ? "" : raw.slice(i + 1));
  return name ? { id, name, perms: normalizePerms(raw.slice(0, i).split(",").map((s) => s.trim())) } : null;
}
