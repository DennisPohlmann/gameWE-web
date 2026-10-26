import { RankBadge, rankName } from "@/components/badges";
import { RankTips } from "@/components/rank-tips";
import { Bar } from "@/components/ui";
import { rankFor, rankStep, type Rank } from "@/lib/career";
import { fmtNum, fmtPct } from "@/lib/format";
import { fill, type Dict, type Lang } from "@/lib/i18n";

// Career rank of one player in a ranking table: a small badge that opens a
// detail box (rank, kills, progress, kills to the next rank) like the career
// row of the player page. Players below the first rank get a dash with the
// way to it.
export function RankCell({ kills, ranks, t, lang }: { kills: number; ranks: Rank[]; t: Dict; lang: Lang }) {
  const rank = rankFor(kills, ranks);
  const step = rankStep(kills, ranks);
  const pc = (v: number) => fmtPct(v, lang);
  const tip = (
    <>
      <b>{rank ? rankName(rank.name) : t.noRankYet}</b>
      {rank ? <span className="tip-line rank-tip-state current">{t.currentRank}</span> : null}
      <span className="tip-line">
        {t.kills}: <b>{fmtNum(kills, lang)}</b>
      </span>
      {step ? (
        <>
          <span className="tip-line">{fill(t.nextRankName, { rank: rankName(step.next.name) })}</span>
          <span className="tip-line">{fill(t.killsNeeded, { n: fmtNum(step.needed, lang), pct: pc(step.share) })}</span>
          <span className="tip-line">
            <Bar value={step.share} wide />
          </span>
        </>
      ) : (
        <span className="tip-line">{t.topRank}</span>
      )}
    </>
  );
  return (
    <RankTips
      items={[
        {
          key: rank?.index ?? -1,
          badge: rank ? <RankBadge name={rank.name} size={20} untitled /> : <span className="rank-none">–</span>,
          tip,
        },
      ]}
    />
  );
}
