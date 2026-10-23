import type { Leader, LeaderCategory } from "@/lib/data";
import { fmtDuration, fmtNum } from "@/lib/format";
import type { Dict, Lang } from "@/lib/i18n";

export function leaderLabel(c: LeaderCategory, t: Dict): string {
  return t[`leader_${c}`];
}

export function leaderValue(l: Leader, lang: Lang): string {
  if (l.category === "connection_time") return fmtDuration(l.value);
  return (l.category === "skill_change" ? "+" : "") + fmtNum(l.value, lang);
}
