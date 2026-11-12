import { rankingGate } from "@/lib/ranking-access";
import type { Metadata } from "next";
import { LineChart } from "@/components/chart";
import { Pie, WeekdayBars } from "@/components/graphics";
import { Flag, Section } from "@/components/ui";
import { getMiscStats } from "@/lib/data";
import { fill, getDict } from "@/lib/i18n";
import { dateFormat, localeOf } from "@/lib/format";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.miscStats };
}

// gameME's "Miscellaneous Statistics": countries, weekdays, connects.
export default async function MiscPage({ params }: { params: Promise<{ game: string }> }) {
  await rankingGate((await params).game);
  const { game } = await params;
  const { lang, t } = await getDict();
  const m = await getMiscStats(game, 30);
  const top = m.countries.slice(0, 8);
  const rest = m.countries.slice(8).reduce((n, c) => n + c.n, 0);
  const slices = [
    ...top.map((c) => ({
      label: c.country || t.unknownCountry,
      value: c.n,
      // No country yet: the neutral placeholder flag, like in the rankings.
      icon: <Flag code={c.flag} title={c.country || t.unknownCountry} />,
    })),
    // Several known countries together: an empty gap of a flag's size instead
    // of the "unknown" placeholder, so the labels stay in line.
    ...(rest ? [{ label: t.otherCountries, value: rest, icon: <span className="flag flag-blank" aria-hidden /> }] : []),
  ];
  const empty = <p className="empty">{t.noData}</p>;
  // Hover text of each day, e.g. "Sa., 25.10.2026".
  const dayTip = dateFormat(localeOf(lang), { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return (
    <>
    <Section title={t.miscStats}>
      {/* One row of equally high boxes, wrapping on narrow screens. */}
      <div className="cont-2 misc-row">
        <div>
          <table className="stats">
            <thead>
              <tr>
                <th>{t.playerCountries}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{slices.length ? <Pie slices={slices} locale={localeOf(lang)} /> : empty}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <table className="stats">
            <thead>
              <tr>
                <th>{t.weekdaysSummary}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {m.weekdays.some((d) => d.connects || d.seconds) ? (
                    <WeekdayBars days={m.weekdays} locale={localeOf(lang)} labels={{ days: t.weekdayNames.split(","), connects: t.connects, time: t.playTime }} />
                  ) : (
                    empty
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        {/* Only shown when the collector records a connect method. */}
        {m.connectTypes.length ? (
          <div>
            <table className="stats">
              <thead>
                <tr>
                  <th>{t.connectMethods}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Pie slices={m.connectTypes.map((c) => ({ label: t.connectTypes[c.type] ?? fill(t.connectType, { n: c.type }), value: c.n }))} locale={localeOf(lang)} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Section>
    {/* Full width like the other trend charts; every day of the range, quiet days as 0. */}
    <Section title={t.connects}>
      {m.connectsPerDay.some((d) => d.n) ? (
        <LineChart
          locale={localeOf(lang)}
          ariaLabel={t.connectsCaption}
          title={t.connectsCaption}
          trimStart={false}
          labels={m.connectsPerDay.map((d) => `${d.day.slice(8, 10)}.${d.day.slice(5, 7)}.`)}
          tips={m.connectsPerDay.map((d) => dayTip.format(Date.parse(`${d.day}T00:00:00Z`)))}
          series={[{ label: t.connects, values: m.connectsPerDay.map((d) => d.n), className: "s1" }]}
        />
      ) : (
        empty
      )}
    </Section>
    </>
  );
}
