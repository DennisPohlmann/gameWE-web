import Link from "next/link";
import type { Dict } from "@/lib/i18n";

// Month calendar of the daily awards, as on gameME: week numbers, one link
// per day up to `last` (the last day with awards); later days, today among
// them, are greyed out. Days with stored winners are marked, today framed.
export function AwardCalendar({
  base,
  month,
  selected,
  today,
  last,
  stored,
  t,
  locale,
}: {
  base: string;
  // "YYYY-MM"
  month: string;
  selected: string;
  today: string;
  // "YYYY-MM-DD", the last day that can be picked.
  last: string;
  stored: Set<string>;
  t: Dict;
  locale: string;
}) {
  const sep = base.includes("?") ? "&" : "?";
  const [y, m] = month.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  const iso = (d: number) => `${month}-${String(d).padStart(2, "0")}`;
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  const next = shift(1);
  const title = first.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  return (
    <table className="award-cal" aria-label={t.awardsCalendar}>
      <caption>
        <Link prefetch={false} href={`${base}${sep}month=${shift(-1)}`} aria-label={t.prevMonth} rel="nofollow">
          ‹
        </Link>{" "}
        <b>{title}</b>{" "}
        {next <= last.slice(0, 7) ? (
          <Link prefetch={false} href={`${base}${sep}month=${next}`} aria-label={t.nextMonth} rel="nofollow">
            ›
          </Link>
        ) : (
          <span className="muted">›</span>
        )}
      </caption>
      <thead>
        <tr>
          <th>{t.week}</th>
          {t.weekdayNames.split(",").map((d) => (
            <th key={d}>{d}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((w, i) => {
          const firstDay = w.find((d) => d !== null)!;
          return (
            <tr key={i}>
              <td className="muted">{isoWeek(Date.UTC(y, m - 1, firstDay))}</td>
              {w.map((d, j) => {
                if (d === null) return <td key={j} />;
                const day = iso(d);
                const cls = [day === selected ? "sel" : "", stored.has(day) ? "has" : "", day === today ? "today" : ""].filter(Boolean).join(" ");
                return (
                  <td key={j} className={cls || undefined}>
                    {day <= last ? (
                      <Link prefetch={false} href={`${base}${sep}date=${day}`} rel="nofollow">
                        {d}
                      </Link>
                    ) : (
                      <span className="muted">{d}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function isoWeek(ms: number): number {
  // The week's Thursday decides the year; count from January 1st.
  const d = new Date(ms);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 3);
  return Math.ceil(((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}
