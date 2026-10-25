import "server-only";
import { currentAdmin } from "./auth";
import { getGame } from "./data";
import { getSettings, titleTemplate } from "./settings";

// Browser title of a ranking's pages (Settings → Browser title in rankings),
// e.g. "GunGame Players | Clan"; a hidden ranking for admins only. Undefined
// for an unknown ranking.
export async function rankingTitle(code: string): Promise<{ template: string; default: string } | undefined> {
  const game = (await getGame(code)) ?? ((await currentAdmin()) ? await getGame(code, true) : undefined);
  if (!game) return undefined;
  const s = await getSettings();
  return titleTemplate(s.titleFormatRanking, { site: s.siteName, ranking: game.name });
}
