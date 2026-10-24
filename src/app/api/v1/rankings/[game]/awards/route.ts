import { api, apiCountry, visibleGame } from "@/lib/api";
import { bad, dayArg } from "@/lib/api-params";
import { getAwardBoard, getAwardDay, type AwardWin } from "@/lib/awards";
import { visiblePlayerIds, type PlayerFlag } from "@/lib/data";
import { siteDay } from "@/lib/day";

// Daily awards of a ranking: without `day` yesterday's winners and today's
// leaders (as on the website's awards page), with `day` the winners of that
// day (the last 365 days; today gives the current leaders).
export function GET(req: Request, { params }: { params: Promise<{ game: string }> }) {
  return api(async () => {
    const { game: code } = await params;
    const game = await visibleGame(code);
    if (!game) return null;
    const day = dayArg(new URL(req.url).searchParams);
    if (day && (day > siteDay() || day < siteDay(-365))) throw bad("invalid day: one of the last 365 days");
    const board = day ? await getAwardDay(game.code, day) : await getAwardBoard(game.code);
    type Row = (typeof board.rows)[number] & { leader?: AwardWin };
    const rows = board.rows as Row[];
    // Stored winners may have been hidden since; they are left out.
    const visible = await visiblePlayerIds(rows.flatMap((r) => [r.winner?.playerId ?? 0, r.leader?.playerId ?? 0]));
    const who = (w: AwardWin | undefined, flags: Map<number, PlayerFlag>) => {
      if (!w || !visible.has(Number(w.playerId))) return null;
      const f = flags.get(Number(w.playerId));
      return { id: Number(w.playerId), name: w.name, country: f && f.flag !== "bot" ? apiCountry(f.flag, f.country) : null, bot: f?.flag === "bot", value: Number(w.value) };
    };
    const today = !day || day === siteDay();
    return {
      game: game.code,
      day: day || board.day,
      leadersDay: !day ? siteDay() : null,
      data: rows.map((r) => ({
        id: Number(r.awardId),
        type: r.awardType,
        code: r.code,
        name: r.name,
        verb: r.verb,
        winner: day === siteDay() ? null : who(r.winner, board.flags),
        leader: !day ? who(r.leader, board.flags) : today ? who(r.winner, board.flags) : null,
      })),
    };
  });
}
