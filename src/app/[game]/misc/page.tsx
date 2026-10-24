import type { Metadata } from "next";
import { LineChart } from "@/components/chart";
import { Pie, WeekdayBars } from "@/components/graphics";
import { Flag, Section } from "@/components/ui";
import Link from "next/link";
import { ServerFlag } from "@/components/live";
import { SigCode } from "@/components/sig-code";
import { getMiscStats, getServers } from "@/lib/data";
import { imageStyles } from "@/lib/image-theme";
import { statsOrigin } from "@/lib/site-url";
import { fill, getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.miscStats };
}

// gameME's "Miscellaneous Statistics": countries, weekdays, connects.
export default async function MiscPage({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  const { lang, t } = await getDict();
  const [m, servers, origin, imgStyles] = await Promise.all([getMiscStats(game, 30), getServers(game), statsOrigin(), imageStyles(lang === "de" ? "de" : "en")]);
  const top = m.countries.slice(0, 8);
  const rest = m.countries.slice(8).reduce((n, c) => n + c.n, 0);
  const slices = [
    ...top.map((c) => ({
      label: c.country || t.unknownCountry,
      value: c.n,
      icon: c.flag ? <Flag code={c.flag} title={c.country} /> : null,
    })),
    ...(rest ? [{ label: t.otherCountries, value: rest }] : []),
  ];
  const empty = <p className="empty">{t.noData}</p>;
  return (
    <>
    <Section title={t.miscStats}>
      <div className="cont-2">
        <div>
          <table className="stats">
            <thead>
              <tr>
                <th>{t.playerCountries}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{slices.length ? <Pie slices={slices} locale={lang} /> : empty}</td>
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
                    <WeekdayBars days={m.weekdays} locale={lang} labels={{ days: t.weekdayNames.split(","), connects: t.connects, time: t.playTime }} />
                  ) : (
                    empty
                  )}
                </td>
              </tr>
            </tbody>
          </table>
          {/* Only shown when the collector records a connect method. */}
          {m.connectTypes.length ? (
            <table className="stats spaced">
              <thead>
                <tr>
                  <th>{t.connectMethods}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <Pie slices={m.connectTypes.map((c) => ({ label: t.connectTypes[c.type] ?? fill(t.connectType, { n: c.type }), value: c.n }))} locale={lang} />
                  </td>
                </tr>
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </Section>
    {/* Full width like the other trend charts; every day of the range, quiet days as 0. */}
    <Section title={t.connects}>
      {m.connectsPerDay.some((d) => d.n) ? (
        <LineChart
          locale={lang}
          ariaLabel={t.connectsCaption}
          trimStart={false}
          labels={m.connectsPerDay.map((d) => `${d.day.slice(8, 10)}.${d.day.slice(5, 7)}.`)}
          series={[{ label: t.connects, values: m.connectsPerDay.map((d) => d.n), className: "s1" }]}
        />
      ) : (
        empty
      )}
      <p className="legend">{t.connectsCaption}</p>
    </Section>
    {/* Banner of every server of this ranking, with its code (also on each server page). */}
    {servers.length ? (
      <Section title={t.serverBanner}>
        {servers.map((s) => (
          <div key={s.serverId} className="box banner-box">
            <h3>
              <ServerFlag code={s.country_code} lang={lang} />
              <Link href={`/${game}/servers/${s.serverId}`}>{s.name || `${s.address}:${s.port}`}</Link>
            </h3>
            <SigCode
              base={`${origin}/banner/${s.serverId}`}
              styles={imgStyles}
              link={`${origin}/${game}/servers/${s.serverId}`}
              alt={`${t.serverBanner}: ${s.name}`}
              width={560}
              height={95}
              labels={{ format: t.sigFormat, style: t.imgStyle, standard: t.imgStandard, url: t.sigImageUrl, copy: t.copy, copied: t.copied }}
            />
          </div>
        ))}
      </Section>
    ) : null}
    </>
  );
}
