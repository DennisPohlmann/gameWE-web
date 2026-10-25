import { api, apiPath, playerTags, visibleGame } from "@/lib/api";
import { pagingArg, paged, sortArg } from "@/lib/api-params";
import { getRankCounts, getRankPlayers, getRanks } from "@/lib/awards";
import { activity } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { rankPlayerSorts, type RankPlayerSort } from "@/lib/table-sort";

const SORTS = Object.keys(rankPlayerSorts) as RankPlayerSort[];

// The ranked players of one rank (by its index in /ranks), by kills, paged:
// the columns of the website's rank table (kills, progress to the next
// rank, points, time, activity).
export function GET(req: Request, { params }: { params: Promise<{ game: string; rank: string }> }) {
  return api(async () => {
    const { game: code, rank: raw } = await params;
    const game = await visibleGame(code);
    if (!game || !/^\d{1,3}$/.test(raw)) return null;
    const ranks = await getRanks(game.code);
    const rank = ranks[Number(raw)];
    if (!rank) return null;
    const q = new URL(req.url).searchParams;
    const p = pagingArg(q);
    const { sort, asc } = sortArg(q, SORTS, "kills", ["name"], { points: "skill" });
    const [rows, counts, { activityDays }] = await Promise.all([getRankPlayers(game.code, rank, p.limit, p.offset, sort, asc), getRankCounts(game.code, ranks), getSettings()]);
    const tag = await playerTags(rows.map((r) => r.playerId));
    const progress = (kills: number) =>
      rank.next === null ? 1 : Math.round(Math.min(1, Math.max(0, (kills - rank.minimum) / (rank.next - rank.minimum))) * 10000) / 10000;
    return paged(
      rows.map((r, i) => ({
        position: p.offset + i + 1,
        id: Number(r.playerId),
        name: r.name,
        ...tag(r.playerId),
        kills: Number(r.kills),
        progress: progress(Number(r.kills)),
        points: Number(r.skill),
        // Deprecated name of points.
        skill: Number(r.skill),
        connectionTime: Number(r.connection_time),
        lastEvent: Number(r.last_event),
        activity: activity(Number(r.last_event), activityDays),
      })),
      counts[rank.index] ?? 0,
      p,
      apiPath(`/rankings/${game.code}/ranks/${rank.index}/players`),
      { sort: sort === "kills" ? undefined : sort, order: q.get("order") ?? undefined },
    );
  });
}
