import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LineChart } from "@/components/chart";
import { Empty, Flag, Pager, PlayerLink, Section, TableWrap, pageParam } from "@/components/ui";
import { RankBadge, rankName } from "@/components/badges";
import { HallStars } from "@/components/hall-stars";
import { fmtDate, fmtDateTime, fmtDuration, fmtNum, fmtPct, localeOf } from "@/lib/format";
import { getHallOfFame, hallOfFameShown, hallSteam, nextHallReset, periodLabel, starTable, type HallEntry, type HallRow, type HallSteam } from "@/lib/hall-of-fame";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";
import { externalImage } from "@/lib/consent";
import { getConsent } from "@/lib/consent-server";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.hallOfFame };
}

// The hall of fame of a ranking: the star table (how often a player made the
// top three) and every reset period with its podium, newest first.
// The star table shows the first STAR_ROWS players unless ?stars=all.
const STAR_ROWS = 10;
// Periods (podiums) per page, newest first.
const PERIODS = 6;

export default async function HallOfFamePage({ params, searchParams }: { params: Promise<{ game: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { game } = await params;
  const sp = await searchParams;
  const allStars = sp.stars === "all";
  const page = pageParam(sp.page);
  if (!(await hallOfFameShown(game))) notFound();
  const { lang, t } = await getDict();
  const [rows, next] = await Promise.all([getHallOfFame(game), nextHallReset(game)]);
  const stars = starTable(rows);
  const locale = localeOf(lang);
  const shownStars = allStars ? stars : stars.slice(0, STAR_ROWS);
  const shownRows = rows.slice((page - 1) * PERIODS, page * PERIODS);
  const [found, consent] = await Promise.all([hallSteam(shownRows), getConsent()]);
  // The pictures come from Steam's image servers: only with consent.
  const steam = new Map([...found].map(([id, p]) => [id, { ...p, avatar: externalImage(consent, p.avatar) }]));
  // Points of places 1 to 3 per period, oldest first.
  const old = [...rows].reverse();
  const pointSeries = [t.hofGold, t.hofSilver, t.hofBronze].map((label, i) => ({
    label,
    values: old.map((r) => r.places[i]?.skill ?? null),
    className: ["hof-g", "hof-s", "hof-b"][i],
  }));
  return (
    <>
      <Section title={t.hallOfFame}>
        <p className="lead">{t.hallOfFameLead}</p>
      </Section>
      {rows.length ? (
        <>
          <Section
            title={t.hofStarTable}
            aside={
              stars.length > STAR_ROWS ? (
                <Link prefetch={false} href={allStars ? `/${game}/hall-of-fame` : `/${game}/hall-of-fame?stars=all`}>{allStars ? fill(t.hofTopN, { n: STAR_ROWS }) : fill(t.hofAllN, { n: fmtNum(stars.length, lang) })}</Link>
              ) : null
            }
          >
            <TableWrap>
              <table className="hof-stars-table">
                <thead>
                  <tr>
                    <th className="num">#</th>
                    <th>{t.player}</th>
                    <th>{t.hofStars}</th>
                    <th className="num hof-count" title={t.hofGold}>
                      <HallStars gold={1} silver={0} bronze={0} label={t.hofGold} />
                    </th>
                    <th className="num hof-count" title={t.hofSilver}>
                      <HallStars gold={0} silver={1} bronze={0} label={t.hofSilver} />
                    </th>
                    <th className="num hof-count" title={t.hofBronze}>
                      <HallStars gold={0} silver={0} bronze={1} label={t.hofBronze} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shownStars.map((s, i) => (
                    <tr key={s.playerId}>
                      <td className="num">{i + 1}</td>
                      <td>
                        <PlayerLink game={game} id={s.playerId} name={s.name} flag={{ flag: s.flag, country: s.country }} />
                      </td>
                      <td>
                        <HallStars gold={s.gold} silver={s.silver} bronze={s.bronze} label={fill(t.hofStarsTip, { gold: s.gold, silver: s.silver, bronze: s.bronze })} />
                      </td>
                      <td className="num hof-count">{s.gold}</td>
                      <td className="num hof-count">{s.silver}</td>
                      <td className="num hof-count">{s.bronze}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
          {old.length > 1 ? (
            <Section title={t.hofPointsChart}>
              <LineChart locale={lang} ariaLabel={t.hofPointsChart} height={200} labels={old.map((r) => periodLabel(r, locale, t.hofWeek, true))} tips={old.map((r) => periodLabel(r, locale, t.hofWeek))} series={pointSeries} trimStart={false} fromZero={false} legend />
            </Section>
          ) : null}
          {shownRows.map((r) => (
            <Period key={r.start} game={game} row={r} steam={steam} t={t} lang={lang} locale={locale} />
          ))}
          {rows.length > PERIODS ? (
            <div className="section">
              <Pager base={`/${game}/hall-of-fame`} params={{ stars: allStars ? "all" : undefined }} page={page} pages={Math.ceil(rows.length / PERIODS)} locale={locale} labels={t} />
            </div>
          ) : null}
        </>
      ) : (
        <Section title={t.hofPeriods}>
          <Empty>{t.hofEmpty}</Empty>
        </Section>
      )}
      {/* When the next places come in: only while a reset is scheduled. */}
      {next ? (
        <p className="muted hof-next">
          {fill(t.hofNextReset, {
            d: "at" in next ? fmtDateTime(next.at, lang) : fmtDate(Date.parse(`${next.day}T12:00:00Z`) / 1000, lang),
          })}
        </p>
      ) : null}
    </>
  );
}

function Period({ game, row, steam, t, lang, locale }: { game: string; row: HallRow; steam: Map<number, HallSteam>; t: Dict; lang: Lang; locale: string }) {
  const date = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { timeZone: "UTC" });
  const range = row.end > row.start ? `${date(row.start)} – ${date(row.end)}` : date(row.start);
  return (
    <Section
      title={
        <>
          <span className="hof-laurel" aria-hidden="true">
            🏆
          </span>{" "}
          {periodLabel(row, locale, t.hofWeek)}
        </>
      }
      aside={
        <span className="muted">
          {range}
          {row.players ? ` · ${fill(t.hofPlayersInPeriod, { n: fmtNum(row.players, lang) })}` : ""}
        </span>
      }
    >
      <ol className="hof-podium">
        {row.places.map((e, i) => (
          <li key={i} className={`hof-card hof-place-${i + 1}`}>
            <Card game={game} place={i + 1} e={e} steam={e ? steam.get(e.playerId) : undefined} t={t} lang={lang} />
          </li>
        ))}
      </ol>
    </Section>
  );
}

// The player's name now (Steam, else the database) with the Steam avatar; the
// name of the period below it when it was a different one.
function Card({ game, place, e, steam, t, lang }: { game: string; place: number; e: HallEntry | null; steam?: HallSteam; t: Dict; lang: Lang }) {
  const medal = (
    <span className="hof-medal" aria-label={fill(t.hofPlace, { n: place })}>
      {place}
    </span>
  );
  if (!e) {
    return (
      <>
        {medal}
        <div className="hof-name muted">–</div>
      </>
    );
  }
  const kd = e.deaths ? e.kills / e.deaths : e.kills;
  const stats: [string, string][] = [
    [t.kills, fmtNum(e.kills, lang)],
    [t.deaths, fmtNum(e.deaths, lang)],
    [t.kpd, fmtNum(kd, lang, 2)],
    [t.headshotsPct, e.kills ? fmtPct(e.headshots / e.kills, lang) : "-"],
    [t.acc, e.shots ? fmtPct(e.hits / e.shots, lang) : "-"],
    [t.hofStreak, fmtNum(e.killStreak, lang)],
    [t.playTime, fmtDuration(e.connectionTime)],
  ];
  const name = steam?.name ?? e.currentName ?? e.name;
  return (
    <>
      {medal}
      {steam?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="hof-avatar" src={steam.avatar} alt="" width={64} height={64} loading="lazy" referrerPolicy="no-referrer" />
      ) : null}
      <div className="hof-name">
        {e.playerId > 0 && e.currentName !== null ? (
          <PlayerLink game={game} id={e.playerId} name={name} flag={{ flag: e.flag, country: e.country }} />
        ) : (
          <>
            <Flag code={e.flag} title={e.country} /> <span className="player">{e.name}</span>
          </>
        )}
      </div>
      {name !== e.name ? <div className="hof-then">{fill(t.hofThen, { name: e.name })}</div> : null}
      <div className="hof-skill">
        {fmtNum(e.skill, lang)} <span>{t.points}</span>
      </div>
      {e.rankName ? (
        <Link prefetch={false} href={`/${game}/awards?view=ranks`} className="hof-rank" title={t.hofRankTip}>
          <RankBadge name={e.rankName} size={40} untitled />
          <span>{rankName(e.rankName)}</span>
        </Link>
      ) : null}
      <dl className="hof-values">
        {stats.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {e.favWeapon ? (
        <div className="hof-weapon">
          {t.favWeapon}: <Link prefetch={false} href={`/${game}/weapons/${encodeURIComponent(e.favWeapon)}`}>{e.favWeaponName ?? e.favWeapon}</Link>
        </div>
      ) : null}
    </>
  );
}
