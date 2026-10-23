import { api } from "@/lib/api";
import { getRankingOverview } from "@/lib/data";

// All rankings with players online and the current number one.
export function GET() {
  return api(async () =>
    (await getRankingOverview()).map((r) => ({
      game: r.code,
      name: r.name,
      baseGame: r.realgame || null,
      servers: r.servers,
      players: r.actPlayers,
      maxPlayers: r.maxPlayers,
      top: r.topPlayerId
        ? { id: r.topPlayerId, name: r.topPlayerName, country: r.topPlayerFlag ? { code: r.topPlayerFlag.trim().toUpperCase(), name: r.topPlayerCountry } : null }
        : null,
      topClan: r.topClanId ? { id: r.topClanId, tag: r.topClanTag } : null,
    })),
  );
}
