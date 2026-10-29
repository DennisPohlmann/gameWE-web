import { api, apiEvent, playerTags } from "@/lib/api";
import { publicClan } from "@/lib/api-clan";
import { getClanMembers } from "@/lib/data";
import { getMembersGameEvents, PLAYER_EVENTS } from "@/lib/history";
import { getSettings } from "@/lib/settings";

// The latest events of the clan page: kills, deaths and actions of the
// active members (at most 25, newest first). 404 while the site shows no
// event boxes.
export function GET(_req: Request, { params }: { params: Promise<{ game: string; id: string }> }) {
  return api(async () => {
    const { game, id } = await params;
    const [found, { playerEvents }] = await Promise.all([publicClan(game, id), getSettings()]);
    if (!found || playerEvents === "off") return null;
    const members = await getClanMembers(found.clan.clanId);
    const rows = await getMembersGameEvents(found.clan.clanId, members.map((m) => Number(m.playerId)), PLAYER_EVENTS);
    const tags = await playerTags(rows.flatMap((r) => [Number(r.actor), Number(r.other)]));
    return { game: found.game.code, id: found.clan.clanId, data: rows.map((e) => apiEvent(e, tags)) };
  });
}
