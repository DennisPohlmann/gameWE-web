import type { PlayerCount as Count } from "@/lib/player-count";
import { fmtNum } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

// "1 (31 BOT) / 48": real players, the bots with the BOT tag of the live
// lists (only when there are any) and the slots (left out with slots={false}).
// dir="ltr": the brackets and the slash keep this order on right-to-left pages.
export function PlayerCount({ count, lang, botsLabel, slots = true }: { count: Count; lang: Lang; botsLabel: string; slots?: boolean }) {
  return (
    <span className="player-count" dir="ltr">
      {fmtNum(count.real, lang)}
      {count.bots > 0 ? (
        <>
          {" ("}
          {fmtNum(count.bots, lang)}{" "}
          <span className="bot-tag" role="img" title={botsLabel} aria-label={botsLabel}>
            BOT
          </span>
          {")"}
        </>
      ) : null}
      {slots ? ` / ${fmtNum(count.max, lang)}` : null}
    </span>
  );
}
