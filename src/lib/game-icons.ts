// The game's icon before a server name: public/games/<code>/icon.png
// (square, at least 32 x 32, shown at 16 px), one folder per base game of games.ts with the
// picture's license in LICENSE.txt. Servers of an unknown game get no icon.
import { basePath } from "./base-path";
import { GAME_KINDS } from "./games";

export function gameIconSrc(realgame: string | null | undefined): string | null {
  const g = (realgame ?? "").trim().toLowerCase();
  return Object.hasOwn(GAME_KINDS, g) ? `${basePath}/games/${g}/icon.png` : null;
}

