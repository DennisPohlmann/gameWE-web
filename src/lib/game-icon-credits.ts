// Who made each game icon in public/games/<code>/ and what gameWE changed,
// for the image credits on /licenses and in THIRD-PARTY-LICENSES.md. The
// full text is the folder's LICENSE.txt (tests/game-icons.test.ts checks
// that both agree).
export type IconEdit = "frame" | "round" | "background" | "scaled" | "drawn";

export type IconCredit = {
  // Rights holder, as in the Author line of LICENSE.txt ("presumably" left out).
  holder: string;
  edits: IconEdit[];
};

const VALVE = "Valve Corporation";

export const GAME_ICON_CREDITS: Record<string, IconCredit> = {
  cs2: { holder: VALVE, edits: [] },
  csgo: { holder: VALVE, edits: [] },
  css: { holder: VALVE, edits: ["scaled"] },
  cstrike: { holder: VALVE, edits: [] },
  czero: { holder: VALVE, edits: [] },
  dod: { holder: VALVE, edits: [] },
  dods: { holder: VALVE, edits: [] },
  fof: { holder: "the Fistful of Frags Team", edits: [] },
  hl2mp: { holder: VALVE, edits: ["scaled"] },
  l4d: { holder: VALVE, edits: [] },
  l4d2: { holder: VALVE, edits: [] },
  nmrih: { holder: "the No More Room in Hell Team", edits: [] },
  tf: { holder: VALVE, edits: [] },
  valve: { holder: VALVE, edits: [] },
  zps: { holder: "the Zombie Panic! Team", edits: [] },
};

// An icon gameWE drew itself (GPL like gameWE) rather than one supplied by the maintainer.
export function isOwnDrawing(c: IconCredit): boolean {
  return c.edits.includes("drawn");
}
