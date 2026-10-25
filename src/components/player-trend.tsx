import { ComboChart } from "./chart";
import { pointsTrend } from "@/lib/points-trend";
import { siteDay } from "@/lib/day";
import type { HistoryDay } from "@/lib/data";
import { dateFormat, localeOf } from "@/lib/format";
import type { Lang } from "@/lib/i18n";

// "Player trend" of the profile and the sessions page: points per day (line,
// left axis) and the points gained or lost that day (bars, right axis).
export function PlayerTrend({
  history,
  before,
  locale,
  t,
}: {
  history: Pick<HistoryDay, "eventTime" | "skill" | "skill_change">[];
  before: number | null;
  locale: Lang;
  t: { points: string; pointsPerDay: string; skillGained: string; skillLost: string; playerTrend: string; noData: string };
}) {
  const trend = pointsTrend(
    history.map((h) => ({ day: String(h.eventTime).slice(0, 10), skill: Number(h.skill), change: Number(h.skill_change) })),
    before,
    siteDay(),
  );
  if (!trend.length) return <span className="muted">{t.noData}</span>;
  // Hover text of each day, e.g. "Sa., 25.10.2026".
  const dayTip = dateFormat(localeOf(locale), { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return (
    <ComboChart
      labels={trend.map((d) => `${d.day.slice(8, 10)}.${d.day.slice(5, 7)}.`)}
      tips={trend.map((d) => dayTip.format(Date.parse(`${d.day}T00:00:00Z`)))}
      line={{ label: t.points, values: trend.map((d) => d.points), className: "s1" }}
      bars={{ values: trend.map((d) => d.change), up: { label: t.skillGained, className: "gain" }, down: { label: t.skillLost, className: "loss" } }}
      axisTitles={{ left: t.points, right: t.pointsPerDay }}
      ariaLabel={t.playerTrend}
      locale={locale}
    />
  );
}
