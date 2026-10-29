import { api, playerTags, publicPlayer } from "@/lib/api";
import { pathId, share } from "@/lib/api-params";
import { getOpponents, type Opponent } from "@/lib/data";

// The ten players this player killed most often and the ten who killed
// this player most often (the profile's victims and killers tables); hidden
// players are left out.
export function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return api(async () => {
    const p = await publicPlayer(pathId((await params).id));
    if (!p) return null;
    const [victims, killers] = await Promise.all([getOpponents(p.game, p.playerId, "victims"), getOpponents(p.game, p.playerId, "killers")]);
    const tag = await playerTags([...victims, ...killers].map((o) => o.playerId));
    const row = (o: Opponent) => ({ id: Number(o.playerId), name: o.name, ...tag(o.playerId), kills: Number(o.kills), headshots: Number(o.headshots), hpk: share(o.headshots, o.kills) });
    return { id: p.playerId, game: p.game, victims: victims.map(row), killers: killers.map(row) };
  });
}
