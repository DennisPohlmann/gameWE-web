import "server-only";
import { visibleGame } from "./api";
import { pathId } from "./api-params";
import { getClan, getClanMembers, getInactiveClanMembers } from "./data";

// A clan of a visible ranking, as the website's clan page: undefined for an
// unknown clan or one of another ranking (404).
export async function publicClan(code: string, rawId: string) {
  const [game, clanId] = [await visibleGame(code), pathId(rawId)];
  if (!game || !clanId) return undefined;
  const clan = await getClan(clanId);
  return clan && clan.game === game.code ? { game, clan } : undefined;
}

// The members the clan page's numbers are over: the active ones, or all of
// them for an inactive clan (fewer than two active members).
export async function clanMembers(clanId: number) {
  const [members, gone] = await Promise.all([getClanMembers(clanId), getInactiveClanMembers(clanId)]);
  const inactive = members.length < 2 && gone.length > 0;
  const all = inactive ? [...members, ...gone] : members;
  return { members, gone, inactive, ids: all.map((m) => Number(m.playerId)) };
}
