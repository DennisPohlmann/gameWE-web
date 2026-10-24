// The modes of a ranking reset of the collector (gamewe reset -mode,
// collector 0.2.0 or newer): player statistics only, player and server
// statistics, or all statistics and the players. "stats" is the old name of
// "player-stats" and only appears in jobs queued before.
export const RESET_MODES = ["player-stats", "all-stats", "all"] as const;
export type ResetMode = (typeof RESET_MODES)[number];

// The mode of a form value, null for anything else.
export function resetMode(v: unknown): ResetMode | null {
  return RESET_MODES.find((m) => m === v) ?? null;
}

// The mode of a stored job (also the old "stats"), null for an unknown one.
export function jobModeName(v: string): ResetMode | null {
  return resetMode(v === "stats" ? "player-stats" : v);
}
