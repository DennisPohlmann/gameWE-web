// The parts of a player profile that open as tabs of their own (?tab=), so
// the overview comes at once: the full profile was the slowest click on a
// phone (4,561 elements, 499 KB HTML). "" is the overview. No imports, so
// the tests can load it directly.
export const PROFILE_TABS = ["maps", "weapons", "opponents", "kills"] as const;
export type ProfileTab = (typeof PROFILE_TABS)[number] | "";

export function profileTab(raw: string | string[] | undefined): ProfileTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return (PROFILE_TABS as readonly string[]).includes(v ?? "") ? (v as ProfileTab) : "";
}

export function profileTabHref(base: string, tab: ProfileTab): string {
  return tab ? `${base}?tab=${tab}` : base;
}
