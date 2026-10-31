// Who made each game icon in public/games/<code>/ and what gameWE changed,
// for the image credits on /licenses and in THIRD-PARTY-LICENSES.md. The
// full text is the folder's LICENSE.txt (tests/game-icons.test.ts checks
// that both agree).
export type IconEdit = "frame" | "round" | "background" | "scaled" | "drawn";

export type IconCredit = {
  // Rights holder, as in the Author line of LICENSE.txt.
  holder: string;
  edits: IconEdit[];
  // The rights holder's own notice (its "All Rights Reserved" page).
  rightsUrl?: string;
};

const VALVE = "Valve Corporation";
// The mod games whose makers cannot be found out: the rights stay with
// whoever holds them, named only like this.
export const GAME_OWNER = "the rights holder of the game";

export const GAME_ICON_CREDITS: Record<string, IconCredit> = {
  cs2: { holder: VALVE, edits: [] },
  csgo: { holder: VALVE, edits: [] },
  css: { holder: VALVE, edits: ["scaled"] },
  cstrike: { holder: VALVE, edits: [] },
  czero: { holder: VALVE, edits: [] },
  dod: { holder: VALVE, edits: [] },
  dods: { holder: VALVE, edits: [] },
  fof: { holder: GAME_OWNER, edits: [] },
  hl2mp: { holder: VALVE, edits: ["scaled"] },
  l4d: { holder: VALVE, edits: [] },
  l4d2: { holder: VALVE, edits: [] },
  nmrih: { holder: GAME_OWNER, edits: [] },
  tf: { holder: VALVE, edits: [] },
  valve: { holder: VALVE, edits: [] },
  zps: { holder: "Zombie Panic Team", edits: [], rightsUrl: "https://zombiepanicsource.com/" },
};

// The Valve icons are listed under the Steam Subscriber Agreement, section
// 2.D ("License to Use Valve Game Content in Fan Art").
export const STEAM_AGREEMENT_URL = "https://store.steampowered.com/agreement";
export const STEAM_AGREEMENT = "Steam Subscriber Agreement 2.D";
export function underSteamAgreement(c: IconCredit): boolean {
  return c.holder === VALVE && !isOwnDrawing(c);
}

// An icon whose rights lie with the game's (unnamed) rights holder.
export function withGameOwner(c: IconCredit): boolean {
  return c.holder === GAME_OWNER;
}

// An icon gameWE drew itself (GPL like gameWE) rather than one supplied by the maintainer.
export function isOwnDrawing(c: IconCredit): boolean {
  return c.edits.includes("drawn");
}
