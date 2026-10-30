// The game's icon before a server name: public/games/<code>/icon.png
// (square, at least 32 x 32, shown at 16 px), one folder per supported base game of games.ts
// with the picture's license in LICENSE.txt. Servers of an unknown or retired game get no icon.
import { basePath } from "./base-path";
import { SUPPORTED_GAMES } from "./games";

export function gameIconSrc(realgame: string | null | undefined): string | null {
  const g = (realgame ?? "").trim().toLowerCase();
  return SUPPORTED_GAMES.includes(g) ? `${basePath}/games/${g}/icon.png` : null;
}

