import { RankBadge } from "@/components/badges";
import { rankFor, type Rank } from "@/lib/career";

// Career rank of one player in a ranking table: a small badge whose detail
// box (rank, kills, progress, kills to the next rank, like the career row of
// the player page) is drawn by the table's one RankCellTips from the kills in
// data-rank-tip. Players below the first rank get a dash.
export function RankCell({ kills, ranks }: { kills: number; ranks: Rank[] }) {
  const rank = rankFor(kills, ranks);
  return (
    <button type="button" className="rank-tip-btn" data-rank-tip={kills}>
      {rank ? <RankBadge name={rank.name} size={20} untitled /> : <span className="rank-none">–</span>}
    </button>
  );
}
