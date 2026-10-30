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
  cs2: { holder: VALVE, edits: ["scaled"] },
  csgo: { holder: VALVE, edits: ["frame"] },
  css: { holder: VALVE, edits: ["round", "frame"] },
  cstrike: { holder: VALVE, edits: ["frame"] },
  czero: { holder: VALVE, edits: ["frame"] },
  dod: { holder: VALVE, edits: ["frame"] },
  dods: { holder: VALVE, edits: ["frame"] },
  fof: { holder: "the Fistful of Frags Team", edits: ["round", "frame"] },
  hl2mp: { holder: VALVE, edits: ["scaled"] },
  l4d: { holder: VALVE, edits: ["frame"] },
  l4d2: { holder: VALVE, edits: ["frame"] },
  nmrih: { holder: "the No More Room in Hell Team", edits: ["round", "frame"] },
  tf: { holder: VALVE, edits: ["frame"] },
  valve: { holder: VALVE, edits: ["frame"] },
  zps: { holder: "the Zombie Panic! Team", edits: ["frame"] },
};

// An icon gameWE drew itself (GPL like gameWE) rather than one supplied by the maintainer.
export function isOwnDrawing(c: IconCredit): boolean {
  return c.edits.includes("drawn");
}
