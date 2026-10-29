import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BanBadges, NameBanMark, sourcebansSearchUrl } from "@/components/ban-badges";
import { Bar, Empty, Flag, PctBar, PlayerLink, Section, TableWrap } from "@/components/ui";
import { SortableTable } from "@/components/sortable-table";
import { RankBadge, Ribbon, RibbonLevel, rankName, ribbonClassName } from "@/components/badges";
import { Spark } from "@/components/graphics";
import { PlayerTrend } from "@/components/player-trend";
import { RankTips } from "@/components/rank-tips";
import { Radar, type RadarAxis } from "@/components/radar";
import { FIXED_MAX, radarPoints, type PlayerRatios, type RadarKey } from "@/lib/radar";
import { MapTable, WeaponStats, WeaponUsage, targetLabels } from "@/components/usage-tables";
import { WeaponTargets } from "@/components/weapon-targets";
import { SigCode } from "@/components/sig-code";
import { PlayerEvents } from "@/components/game-events";
import { ZONES } from "@/lib/zones";
import { awardValue, getAwards, getPlayerRibbons, getRanks, getRibbonClasses, rankFor, ribbonFor, ribbonProgress } from "@/lib/awards";
import { siteDay } from "@/lib/day";
import { HallStars } from "@/components/hall-stars";
import { getPlayerStars, hallOfFameShown, type StarCount } from "@/lib/hall-of-fame";
import { getSteamBans, getSteamProfile, type SteamProfile as SteamProfileData } from "@/lib/steam";
import { PlayerLinks, historyAccess } from "@/components/player-history";
import { bannerUrl, statsOrigin } from "@/lib/site-url";
import { shareMetadata } from "@/lib/share-meta";
import { imageStyles } from "@/lib/image-theme";
import { getSettings } from "@/lib/settings";
import { externalImage } from "@/lib/consent";
import { getConsent } from "@/lib/consent-server";
import { peekSourcebans } from "@/lib/sourcebans";
import { banKind, mergeBans, steamBanEntry, type BanEntry, type BanKind } from "@/lib/ban-merge";
import { placeHref } from "@/components/ranking";
import {
  getChat,
  getOpponents,
  getPlayerKillStats,
  getPlayer,
  type PlayerDetail,
  getPlayerActions,
  getPlayerAwards,
  getPlayerBans,
  getPlayerFlags,
  noProfile,
  getPlayerHistory,
  getPlayerSkillBefore,
  getPlayerMaps,
  getPlayerNames,
  getPlayerPosition,
  getPlayerTeams,
  getRadarAverage,
  getPlayerWeapons,
  gameHasShots,
} from "@/lib/data";
import { activity, fmtAge, fmtBanMinutes, fmtDate, fmtDateTime, fmtDuration, fmtNum, fmtPct, kpd, nowUnix, ratio, steamIds } from "@/lib/format";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function playerId(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = playerId((await params).id);
  const p = id ? await getPlayer(id) : undefined;
  if (!p || (await noProfile(p, true))) return { title: `#${id}` };
  const [{ lang, t }, { siteName }, position, image] = await Promise.all([
    getDict(),
    getSettings(),
    p.hideranking ? Promise.resolve(null) : getPlayerPosition(p.game, p.skill),
    bannerUrl(p.game, "player", p.playerId),
  ]);
  const name = p.name ?? `#${id}`;
  const text = position
    ? fill(t.shareTextPlayer, { name, site: siteName, rank: fmtNum(position, lang), points: fmtNum(p.skill, lang) })
    : fill(t.shareTextPlayerHidden, { name, site: siteName });
  // Hidden players keep their profile, but search engines leave it out.
  return shareMetadata({ title: name, page: `${t.players}: ${name}`, text, image, noindex: !!p.hideranking });
}

export default async function PlayerPage({ params, searchParams }: Props) {
  const { game, id: raw } = await params;
  const id = playerId(raw);
  if (!id) notFound();
  const p = await getPlayer(id);
  if (!p || (await noProfile(p, true))) notFound();
  if (p.game !== game) redirect(`/${p.game}/players/${id}`);

  const { lang, t } = await getDict();
  const [settings, access] = await Promise.all([getSettings(), historyAccess()]);
  const ids = steamIds(p.uniqueId);
  const [position, history, names, weapons, maps, teams, actions, victims, killers, killStats, awards, ranks, chat, ribbons, allAwards, classes, sigUrl, origin, skillBefore] =
    await Promise.all([
      p.hideranking ? Promise.resolve(null) : getPlayerPosition(game, p.skill),
      getPlayerHistory(id, 30),
      getPlayerNames(id),
      getPlayerWeapons(id),
      getPlayerMaps(id),
      getPlayerTeams(id),
      getPlayerActions(id),
      getOpponents(id, "victims"),
      getOpponents(id, "killers"),
      getPlayerKillStats(id),
      getPlayerAwards(id),
      getRanks(game),
      access.chat ? getChat({ playerId: id, limit: 15, offset: 0 }) : Promise.resolve([]),
      getPlayerRibbons(id),
      getAwards(game),
      getRibbonClasses(game),
      bannerUrl(game, "player", id),
      statsOrigin(),
      getPlayerSkillBefore(id, 30),
    ]);
  // The rest of the reads at once, not one after the other.
  const [imgStyles, flags, shots, radarAvg, hallShown, bans] = await Promise.all([
    imageStyles(lang === "de" ? "de" : "en"),
    getPlayerFlags([...victims.map((o) => o.playerId), ...killers.map((o) => o.playerId), ...killStats.map((o) => o.playerId)]),
    // Counter-Strike 2 logs no shots (and the collector counts no hits for
    // it): no accuracy, no shots per kill.
    gameHasShots(game),
    getRadarAverage(game),
    hallOfFameShown(game),
    profileBans(p, ids?.steam64 ?? null, settings.sourcebansUrl, t),
  ]);
  const stars = hallShown ? await getPlayerStars(game, id) : null;
  // Hidden players stay out of the list; bots are shown with their tag.
  const killList = killStats.filter((o) => o.hideranking === 0 || flags.get(o.playerId)?.flag === "bot");

  const last14 = history.filter((h) => h.eventTime >= siteDay(-13));

  const kills14 = last14.reduce((s, h) => s + h.kills, 0);
  const hs14 = last14.reduce((s, h) => s + h.headshots, 0);
  const isBot = (p.uniqueId ?? "").startsWith("BOT");
  const fav = weapons[0];
  const rank = rankFor(p.kills, ranks);
  const rankProgress = rank && rank.next !== null ? (p.kills - rank.minimum) / (rank.next - rank.minimum) : 1;
  // City, state and country link to the ranking of that place.
  const code = /^[a-z]{2}$/i.test(p.flag ?? "") ? (p.flag as string) : "";
  const location = [
    p.city ? (code ? <Link prefetch={false} key="c" href={placeHref(game, code, p.city)}>{p.city}</Link> : p.city) : null,
    // A legacy HLstatsX region code ("02") has no state ranking.
    p.state ? (code && p.state.length > 3 ? <Link prefetch={false} key="s" href={placeHref(game, code, "", p.state)}>{p.state}</Link> : p.state) : null,
    p.country ? (code ? <Link prefetch={false} key="l" href={placeHref(game, code)}>{p.country}</Link> : p.country) : null,
  ]
    .filter(Boolean)
    .flatMap((x, i) => (i ? [", ", x] : [x]));
  const age = fmtAge(p.last_event, lang);
  const totalTeamJoins = teams.reduce((s, x) => s + x.joined, 0);
  const zoneTotal = (w: (typeof weapons)[number]) => ZONES.reduce((n, z) => n + w[z], 0);
  const hitboxWeapons = [
    { name: t.allWeapons, hits: Object.fromEntries(ZONES.map((z) => [z, weapons.reduce((n, w) => n + w[z], 0)])) as Record<(typeof ZONES)[number], number> },
    ...weapons.filter((w) => zoneTotal(w) > 0).map((w) => ({ name: w.name, hits: Object.fromEntries(ZONES.map((z) => [z, w[z]])) as Record<(typeof ZONES)[number], number> })),
  ];

  // Two weeks against all time, and the daily spread, for the summary graphics.
  const sum14 = (k: keyof (typeof history)[number]) => last14.reduce((n, h) => n + Number(h[k]), 0);
  const kpdNow = sum14("kills") / Math.max(1, sum14("deaths"));
  const hpkNow = ratio(hs14, kills14);
  const accNow = ratio(sum14("hits"), sum14("shots"));
  const daily = (f: (h: (typeof history)[number]) => number | null) => history.map(f).filter((v): v is number => v !== null && Number.isFinite(v));
  const kpdDays = daily((h) => (h.kills || h.deaths ? h.kills / Math.max(1, h.deaths) : null));
  const hpkDays = daily((h) => (h.kills ? h.headshots / h.kills : null));
  const accDays = daily((h) => (h.shots ? h.hits / h.shots : null));
  const spkNow = kills14 ? sum14("shots") / kills14 : null;
  const spkDays = daily((h) => (h.kills && h.shots ? h.shots / h.kills : null));
  const days14 = t.last14.replace(/^\*\s*/, "");
  const sparkTitles = { total: t.total, current: `${t.current} (${days14})`, min: `${t.min} (${t.last30})`, max: `${t.max} (${t.last30})`, days: t.last30 };
  const n2 = (v: number | null) => fmtNum(v, lang, 2);
  const pc = (v: number | null) => fmtPct(v, lang);
  const kpm = (kills: number, secs: number) => (secs > 0 ? kills / (secs / 60) : 0);
  // Radar: the player's last two weeks against the average of all players
  // active in them; radar.ts places the average on the middle ring, keeps
  // the four core axes, adds assists only when the game records them and
  // marks the axes without data.
  const r14 = (num: number, den: number) => (last14.length ? { num, den } : null);
  const radarRatios: PlayerRatios = {
    kpd: r14(kills14, sum14("deaths")),
    kpm: r14(kills14, sum14("connection_time")),
    assists: r14(sum14("kill_assists"), kills14),
    survived: r14(sum14("survived_count"), sum14("rounds")),
    wins: r14(sum14("wins"), sum14("rounds")),
  };
  const radarPts = radarPoints(radarRatios, radarAvg);
  const radarLabel: Record<RadarKey, string> = { kpd: t.kpd, kpm: t.kpm, assists: t.assists, survived: t.survived, wins: t.winRatioShort };
  const radarValue = (key: RadarKey, v: number | null, count?: number) =>
    v === null
      ? "—"
      : key === "survived" || key === "wins"
        ? pc(v)
        : key === "assists"
          ? `${n2(v)} ${t.perKill}${count === undefined ? "" : ` (${fmtNum(count, lang)})`}`
          : n2(v);
  // The player against the average: rounded to a whole per cent, as shown.
  const radarRelation = (a: (typeof radarPts)[number]) => {
    if (a.noData) return t.winNoData;
    if (a.rel === null) return "";
    const d = Math.round((a.rel - 1) * 100) / 100;
    return d === 0 ? t.radarEqual : fill(d > 0 ? t.radarAbove : t.radarBelow, { pct: pc(Math.abs(d)) });
  };
  const radar: RadarAxis[] = radarPts.map((a) => ({
    label: radarLabel[a.key],
    noData: a.noData,
    avg: a.rAvg,
    player: a.r,
    avgText: radarValue(a.key, a.avg),
    playerText: radarValue(a.key, a.value, sum14("kill_assists")),
    relation: radarRelation(a),
    scale: a.rAvg > 0 ? t.radarRings : fill(t.radarScale, { max: fmtNum(FIXED_MAX[a.key], lang, a.key === "assists" ? 1 : 0) }),
  }));
  const radarNotes = [
    last14.length ? "" : t.radarInactive,
    radarAvg.players ? fill(t.radarCompared, { n: fmtNum(radarAvg.players, lang) }) : "",
  ].filter(Boolean);
  const wonAwards = new Map(ribbons.map((r) => [r.awardId, r.wins]));
  const totalRibbonWins = ribbons.reduce((n, r) => n + r.wins, 0);

  const profile = { game, id, p, ids, isBot, location, age, fav, stars, bans, sourcebans: !!settings.sourcebansUrl, sourcebansUrl: settings.sourcebansUrl, t, lang };

  return (
    <>
      <Section title={t.playerInfo}>
        <div className="cont-2">
          {/* The Steam profile is asked after the page is sent: the table
              comes without the Steam rows first and is swapped once the
              answer is there, so a slow Steam never holds the page. */}
          <Suspense fallback={<ProfileTable steam={null} pending {...profile} />}>
            <SteamProfile steam64={ids?.steam64 ?? null} {...profile} />
          </Suspense>

          {/* Summary and the history links below it share the right column. */}
          <div className="summary-box">
          <table className="stats summary">
            {/* gameME's split: the left half holds position and points (four
                cells) and below them the radar, the right half the labels
                and values beside it; the rows below put the label in the
                left half and the value in the right one. */}
            <colgroup>
              <col className="sum-q" />
              <col className="sum-q" />
              <col className="sum-q" />
              <col className="sum-q" />
              <col className="sum-key" />
              <col className="sum-val" />
            </colgroup>
            <thead>
              <tr>
                <th colSpan={6}>{t.playerSummary}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="stats-key pair">{t.position}:</td>
                {/* A banned player (the only hidden one with a profile) has no place and no points. */}
                <td className="pair-value">
                  {p.hideranking ? <i className="muted">{t.notListed}</i> : <b>{position ? fmtNum(position, lang) : "-"}</b>}
                </td>
                <td className="stats-key pair">{t.points}:</td>
                <td className="pair-value">
                  {p.hideranking ? (
                    "–"
                  ) : (
                    <>
                      <b>{fmtNum(p.skill, lang)}</b>{" "}
                      <span className={p.last_skill_change >= 0 ? "good" : "bad"}>
                        ({p.last_skill_change > 0 ? "+" : ""}
                        {fmtNum(p.last_skill_change, lang)})
                      </span>
                    </>
                  )}
                </td>
                <td className="stats-key">{t.activity}:</td>
                <td className="barcell">
                  <Bar value={activity(p.last_event, settings.activityDays) / 100} activity label={`${activity(p.last_event, settings.activityDays)} %`} />
                </td>
              </tr>
              <tr>
                <td colSpan={4} rowSpan={7} className="radar-cell">
                  <Radar axes={radar} labels={{ avg: t.radarAll, player: t.radarPlayer }} notes={radarNotes} />
                </td>
                <td className="stats-key">{t.kills}:</td>
                <td>
                  {fmtNum(p.kills, lang)} ({fmtNum(kills14, lang)}*)
                </td>
              </tr>
              <tr>
                <td className="stats-key">{t.deaths}:</td>
                <td>{fmtNum(p.deaths, lang)}</td>
              </tr>
              <tr>
                <td className="stats-key">{t.hs}:</td>
                <td>
                  {fmtNum(p.headshots, lang)} ({fmtNum(hs14, lang)}*)
                </td>
              </tr>
              <tr>
                <td className="stats-key">{t.kpdLong}:</td>
                <td>
                  <Spark values={kpdDays} total={kpd(p.kills, p.deaths)} current={kpdNow} fmt={n2} titles={sparkTitles} />
                </td>
              </tr>
              <tr>
                <td className="stats-key">{t.hpkLong}:</td>
                <td>
                  <Spark values={hpkDays} total={ratio(p.headshots, p.kills)} current={hpkNow} fmt={pc} titles={sparkTitles} />
                </td>
              </tr>
              <tr>
                <td className="stats-key">{t.suicides}:</td>
                <td>{fmtNum(p.suicides, lang)}</td>
              </tr>
              <tr>
                <td className="stats-key">{t.killsPerMin}:</td>
                <td>{n2(kpm(p.kills, p.connection_time))}</td>
              </tr>
              {/* Rounds count only with a winner: servers without win triggers (GunGame, DM) have none. */}
              <Row4 k={t.rounds} v={p.rounds ? `${fmtNum(p.rounds, lang)} (${t.wins}: ${fmtNum(p.wins, lang)}, ${t.losses}: ${fmtNum(p.losses, lang)})` : "—"} />
              <Row4 k={t.winRatio} v={p.rounds ? <Bar value={ratio(p.wins, p.rounds)} green label={pc(ratio(p.wins, p.rounds))} /> : "—"} />
              <Row4 k={t.survived} v={p.rounds ? `${fmtNum(p.survived_count, lang)} ${t.rounds} (${pc(ratio(p.survived_count, p.rounds))})` : "—"} />
              <Row4 k={t.teamkills} v={fmtNum(p.team_kills, lang)} />
              {shots ? (
                <>
                  <Row4
                    k={t.acc}
                    v={<Spark values={accDays} total={ratio(p.hits, p.shots)} current={accNow} fmt={pc} titles={sparkTitles} />}
                  />
                  <Row4
                    k={t.shotsPerKill}
                    v={<Spark values={spkDays} total={p.kills && p.shots ? p.shots / p.kills : null} current={spkNow} fmt={n2} titles={sparkTitles} lowerIsBetter />}
                  />
                </>
              ) : null}
              {/* Assisted kills (kills of this player others helped with) only when the collector counted any. */}
              <Row4 k={t.assists} v={`${fmtNum(p.kill_assists, lang)}${p.kills_assisted > 0 ? ` · ${t.assistedKills}: ${fmtNum(p.kills_assisted, lang)}` : ""}`} />
              <Row4 k={t.killStreak} v={fmtNum(p.kill_streak, lang)} />
            </tbody>
          </table>
          {/* The history links and the note on the starred values share one line. */}
          <div className="summary-foot">
            {/* A banned player's history pages stay closed (only the profile shows the ban). */}
            <PlayerLinks game={game} id={id} name={p.name} t={t} />
            <p className="footnote">{t.last14}</p>
          </div>
          </div>
        </div>
      </Section>

      <Section title={t.playerStats}>
        <div className="cont-2">
          <div>
            <table className="stats">
              <thead>
                <tr>
                  <th>
                    {t.playerTrend} (
                    <Link prefetch={false} className="th-link" href={`/${game}/players/${id}/sessions`}>
                      {t.overview}
                    </Link>
                    )
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="center">
                    <PlayerTrend history={history} before={skillBefore} locale={lang} t={t} />
                  </td>
                </tr>
              </tbody>
            </table>
            {rank ? (
              <table className="stats spaced">
                <thead>
                  <tr>
                    <th colSpan={2}>
                      {t.currentRank}: <b>{rankName(rank.name)}</b>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={2} className="center">
                      <Link prefetch={false} href={`/${game}/awards?view=ranks&rank=${rank.index}`}>
                        <RankBadge name={rank.name} size={110} />
                      </Link>
                    </td>
                  </tr>
                  <tr>
                    <td className="barcell" style={{ width: "50%" }}>
                      <Bar value={rankProgress} wide label={pc(rankProgress)} />
                    </td>
                    <td className="center">
                      {rank.next !== null ? fill(t.killsNeeded, { n: fmtNum(rank.next - p.kills, lang), pct: pc(rankProgress) }) : t.topRank}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}
            {ranks.length ? (
              <table className="stats spaced">
                <thead>
                  <tr>
                    <th>
                      {t.career} (<Link prefetch={false} href={`/${game}/awards?view=ranks`}>{t.ranksOverview}</Link>)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="career">
                      <RankTips
                        items={ranks.map((r) => {
                          const range =
                            r.next !== null
                              ? fill(t.killsRange, { min: fmtNum(r.minimum, lang), max: fmtNum(r.next - 1, lang) })
                              : fill(t.killsFrom, { min: fmtNum(r.minimum, lang) });
                          const current = r.index === rank?.index;
                          // Progress towards the next rank (current) or towards this one (locked).
                          const goal = current ? r.next : p.kills < r.minimum ? r.minimum : null;
                          const from = current ? r.minimum : 0;
                          const share = goal !== null ? Math.max(0, Math.min(1, (p.kills - from) / Math.max(1, goal - from))) : null;
                          return {
                            key: r.index,
                            badge: <RankBadge name={r.name} size={40} dim={p.kills < r.minimum} untitled />,
                            tip: (
                              <>
                                <b>{rankName(r.name)}</b>
                                <span className="tip-line">{range}</span>
                                <span className={`tip-line rank-tip-state ${current ? "current" : p.kills < r.minimum ? "locked" : "reached"}`}>
                                  {current ? t.currentRank : p.kills < r.minimum ? t.rankLocked : t.rankReached}
                                </span>
                                {current || goal !== null ? (
                                  <span className="tip-line">
                                    {t.kills}: <b>{fmtNum(p.kills, lang)}</b>
                                  </span>
                                ) : null}
                                {goal !== null && share !== null ? (
                                  <>
                                    <span className="tip-line">{fill(t.killsNeeded, { n: fmtNum(goal - p.kills, lang), pct: pc(share) })}</span>
                                    <span className="tip-line">
                                      <Bar value={share} wide />
                                    </span>
                                  </>
                                ) : current ? (
                                  <span className="tip-line">{t.topRank}</span>
                                ) : null}
                              </>
                            ),
                          };
                        })}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}
          </div>
          <div>
            {/* A banned player has no banner (it is 404), so no signature box either. */}
            {p.hideranking ? null : (
              <table className="stats">
                <thead>
                  <tr>
                    <th>{t.forumSignature}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <SigCode
                        base={sigUrl.replace(/\.png$/, "")}
                        styles={imgStyles}
                        link={`${origin}/${game}/players/${id}`}
                        alt={`${t.forumSignature}: ${p.name ?? id}`}
                        width={400}
                        height={100}
                        labels={{ format: t.sigFormat, style: t.imgStyle, standard: t.imgSkinDefault, url: t.sigImageUrl, copy: t.copy, copied: t.copied }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
            {allAwards.length ? (
              <table className="stats spaced">
                <thead>
                  <tr>
                    <th>
                      {t.ribbons} ({fill(t.winsCount, { n: totalRibbonWins })}, <Link prefetch={false} href={`/${game}/awards?view=ribbons`}>{t.ribbonsOverview}</Link>)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="ribbon-wall">
                      {[...allAwards]
                        .sort((a, b) => (wonAwards.get(b.awardId) ?? 0) - (wonAwards.get(a.awardId) ?? 0))
                        .map((a) => {
                          const wins = wonAwards.get(a.awardId) ?? 0;
                          const r = ribbonFor(wins, classes);
                          return (
                            <Link prefetch={false} key={a.awardId} href={`/${game}/awards?view=ribbons&award=${a.awardId}`}>
                              <Ribbon
                                code={a.code}
                                label={a.name}
                                title={r ? `${a.name}: ${ribbonClassName(r.name, lang)} ${r.level} (${fill(t.winsCount, { n: wins })})` : a.name}
                                ribbon={r}
                              />
                              <RibbonLevel
                                progress={ribbonProgress(wins, classes)}
                                className={(n) => ribbonClassName(n, lang)}
                                texts={{ toNext: t.ribbonToNext, maxed: t.ribbonMaxed }}
                              />
                            </Link>
                          );
                        })}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}
          </div>
        </div>
      </Section>

      {/* From here on gameME's order: teams and actions, maps, weapon
          usage, weapon targets, weapons and the kill statistics; what
          gameME lacks (victims and killers, events, names, awards, chat)
          follows below. */}
      {teams.length || actions.length ? (
        <Section title={t.teamsActions}>
          <div className="cont-2">
            {teams.length ? (
              <TableWrap>
                <SortableTable
                  initial={1}
                  cols={[{ label: t.team }, { label: t.joined, className: "num" }, { label: t.percentage, className: "barcell", noSort: true }]}
                  rows={teams.map((x) => ({
                    key: x.id,
                    values: [x.name, x.joined, null],
                    cells: [x.name, fmtNum(x.joined, lang), <PctBar key="s" value={ratio(x.joined, totalTeamJoins)} lang={lang} tone="share" />],
                  }))}
                />
              </TableWrap>
            ) : null}
            {actions.length ? (
              <TableWrap>
                <SortableTable
                  initial={1}
                  cols={[{ label: t.actions }, { label: t.count, className: "num" }, { label: t.reward, className: "num" }]}
                  rows={actions.map((a) => ({
                    key: a.id,
                    values: [a.description, a.count, a.points],
                    cells: [
                      <Link prefetch={false} key="a" href={`/${game}/actions/${a.id}`}>
                        {a.description}
                      </Link>,
                      fmtNum(a.count, lang),
                      fmtNum(a.points, lang),
                    ],
                  }))}
                />
              </TableWrap>
            ) : null}
          </div>
        </Section>
      ) : null}

      {maps.length ? (
        <Section title={t.mapPerformance}>
          <MapTable maps={maps} game={game} t={t} lang={lang} />
        </Section>
      ) : null}

      {weapons.length ? (
        <Section title={t.weaponUsage}>
          <WeaponUsage weapons={weapons} game={game} t={t} lang={lang} />
        </Section>
      ) : null}

      {hitboxWeapons[0] && ZONES.some((z) => hitboxWeapons[0].hits[z] > 0) ? (
        <Section id="targets" title={t.weaponTargets}>
          <WeaponTargets weapons={hitboxWeapons} locale={lang} labels={targetLabels(t)} initial={hwParam((await searchParams).hw, hitboxWeapons.length)} />
        </Section>
      ) : null}

      {weapons.length ? (
        <Section title={t.weapons}>
          <WeaponStats weapons={weapons} game={game} shots={shots} t={t} lang={lang} />
        </Section>
      ) : null}

      {killList.length ? (
        <Section title={t.killStats}>
          <p className="muted small">{t.killStatsHint}</p>
          <TableWrap>
            <SortableTable
              initial={2}
              cols={[
                { label: t.player },
                { label: t.position, className: "num" },
                { label: t.kills, className: "num" },
                { label: t.deaths, className: "num" },
                { label: t.kpd, className: "num" },
                { label: t.hs, className: "num hide-sm" },
                { label: t.hpk, className: "barcell" },
              ]}
              rows={killList.map((o) => ({
                key: o.playerId,
                values: [o.name ?? "", o.position, o.kills, o.deaths, kpd(o.kills, o.deaths), o.headshots, ratio(o.headshots, o.kills)],
                cells: [
                  <PlayerLink key="p" game={game} id={o.playerId} name={o.name} flag={flags.get(o.playerId)} />,
                  o.position ? fmtNum(o.position, lang) : "-",
                  fmtNum(o.kills, lang),
                  fmtNum(o.deaths, lang),
                  fmtNum(kpd(o.kills, o.deaths), lang, 2),
                  fmtNum(o.headshots, lang),
                  <PctBar key="h" value={ratio(o.headshots, o.kills)} lang={lang} />,
                ],
              }))}
            />
          </TableWrap>
        </Section>
      ) : null}

      {victims.length || killers.length ? (
        <div className="grid-2">
          {victims.length ? <OpponentTable title={t.victims} rows={victims} game={game} t={t} lang={lang} flags={flags} /> : null}
          {killers.length ? <OpponentTable title={t.killers} rows={killers} game={game} t={t} lang={lang} flags={flags} /> : null}
        </div>
      ) : null}

      {p.hideranking ? null : <PlayerEvents game={game} playerId={id} t={t} lang={lang} />}

      <div className="grid-2">
        {names.length ? (
          <Section title={t.names}>
            <TableWrap>
              <SortableTable
                initial={3}
                cols={[{ label: t.name }, { label: t.time, className: "num" }, { label: t.kills, className: "num" }, { label: t.lastUse, className: "num hide-sm" }]}
                rows={names.map((n) => ({
                  key: n.name,
                  values: [n.name, n.connection_time, n.kills, n.lastuse || null],
                  cells: [n.name, fmtDuration(n.connection_time), fmtNum(n.kills, lang), n.lastuse ? `${n.lastuse.slice(0, 16)} UTC` : "-"],
                }))}
              />
            </TableWrap>
          </Section>
        ) : null}

        {awards.length ? (
          <Section title={t.awards}>
            <TableWrap>
              <table>
                <tbody>
                  {awards.map((a, i) => (
                    <tr key={i}>
                      <td className="muted">{a.date}</td>
                      <td>{a.name}</td>
                      <td className="num">
                        {awardValue(a, a.winner_count, (n) => fmtNum(n, lang), fmtDuration)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        ) : null}

        {chat.length ? (
          <Section title={t.chat}>
            <TableWrap>
              <table>
                <tbody>
                  {chat.map((c, i) => (
                    <tr key={i}>
                      <td className="muted nowrap">{fmtDateTime(c.timestamp_id, lang)}</td>
                      <td className="wrap-cell">
                        {c.message_mode === 2 ? <span className="muted">({t.sayTeam}) </span> : null}
                        {c.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        ) : null}
      </div>

      {!weapons.length && !history.length ? <Empty>{t.noData}</Empty> : null}
    </>
  );
}

function OpponentTable({
  title,
  rows,
  flags,
  game,
  t,
  lang,
}: {
  title: string;
  rows: Awaited<ReturnType<typeof getOpponents>>;
  flags: Awaited<ReturnType<typeof getPlayerFlags>>;
  game: string;
  t: Awaited<ReturnType<typeof getDict>>["t"];
  lang: Awaited<ReturnType<typeof getDict>>["lang"];
}) {
  return (
    <Section title={title}>
      <TableWrap>
        <SortableTable
          initial={1}
          cols={[{ label: t.player }, { label: t.kills, className: "num" }, { label: t.hpk, className: "num" }]}
          rows={rows.map((o) => ({
            key: o.playerId,
            values: [o.name ?? "", Number(o.kills), ratio(o.headshots, o.kills)],
            cells: [
              <PlayerLink key="p" game={game} id={o.playerId} name={o.name} flag={flags.get(o.playerId)} />,
              fmtNum(o.kills, lang),
              fmtPct(ratio(o.headshots, o.kills), lang),
            ],
          }))}
        />
      </TableWrap>
    </Section>
  );
}

type ProfileProps = {
  game: string;
  id: number;
  p: PlayerDetail;
  ids: ReturnType<typeof steamIds>;
  isBot: boolean;
  location: React.ReactNode[];
  age: string | null;
  fav: { code: string; name: string } | undefined;
  stars: StarCount | null;
  bans: BanEntry[];
  sourcebans: boolean; // the site checks SourceBans (address set)
  sourcebansUrl: string; // its address, for the link of the badge
  t: Dict;
  lang: Lang;
};

// The running bans of the player shown in the profile: the collector's
// records (hlstats_Players_Bans), the SourceBans list (as on the bans page,
// read every 30 minutes; not waited for), and for a player hidden as banned
// without either a server ban without details (a VAC kick or a permanent
// server ban). The VAC ban from Steam is added in ProfileTable (with an API
// key from Steam's ban list, as on the bans page, so game bans count too). Expired and
// lifted bans are none.
async function profileBans(p: PlayerDetail, steam64: string | null, sourcebansUrl: string, t: Dict): Promise<BanEntry[]> {
  const out: BanEntry[] = [];
  for (const rec of await getPlayerBans(p.playerId)) {
    const len = Number(rec.length_minutes);
    out.push({ kind: banKind(rec.ban_type), reason: rec.reason ?? "", at: Number(rec.banned_at) || null, dateText: "", length: len ? fmtBanMinutes(len) : t.banStatePermanent, until: Number(rec.ends_at) || null });
  }
  if (sourcebansUrl && steam64 && !out.some((b) => b.kind === "sourcebans")) {
    const sb = peekSourcebans(sourcebansUrl)?.bans.find((b) => b.steam64 === steam64 && (b.state === "permanent" || b.state === "active"));
    if (sb) {
      const d = /^\d{4}-\d\d-\d\dT/.test(sb.date) ? Date.parse(sb.date) : NaN;
      out.push({ kind: "sourcebans", reason: sb.reason, at: Number.isNaN(d) ? null : Math.floor(d / 1000), dateText: sb.date, length: sb.state === "permanent" ? t.banStatePermanent : sb.length, until: null });
    }
  }
  if (!out.length && Number(p.hideranking) === 2) out.push({ kind: "engine", reason: "", at: null, dateText: "", length: "", until: null });
  return out;
}


// The profile table with the Steam data, asked here so the rest of the page
// does not wait for Steam (up to five seconds when it is slow or down).
async function SteamProfile({ steam64, ...rest }: ProfileProps & { steam64: string | null }) {
  const [found, consent] = await Promise.all([steam64 ? getSteamProfile(steam64) : null, getConsent()]);
  // After the profile: its Steam request also fills the ban cache.
  const ban = steam64 ? (await getSteamBans([steam64])).get(steam64) : undefined;
  // The picture comes from Steam's image servers: only with consent, else
  // the placeholder with the initial.
  const steam = found && { ...found, avatar: externalImage(consent, found.avatar), avatarSmall: externalImage(consent, found.avatarSmall) };
  return <ProfileTable steam={steam} steamBan={ban ? steamBanEntry(ban, nowUnix()) : undefined} {...rest} />;
}

// "Member since" in the site's date format, without a time: Steam's API
// gives YYYY-MM-DD (taken at noon UTC so no time zone moves the day), the
// community page a text such as "December 4, 2024"; anything else as it is.
function memberDate(v: string, lang: Lang): string {
  const ms = Date.parse(/^\d{4}-\d\d-\d\d$/.test(v) ? `${v}T12:00:00Z` : v);
  return Number.isNaN(ms) ? v : fmtDate(Math.floor(ms / 1000), lang);
}

// pending: Steam has not answered yet (the fallback while it is asked).
// steamBan: the ban from Steam's ban list (null: none there; undefined: not
// asked, no API key), else the profile's VAC flag counts.
function ProfileTable({ steam, steamBan, pending = false, game, id, p, ids, isBot, location, age, fav, stars, bans: found, sourcebans, sourcebansUrl, t, lang }: ProfileProps & { steam: SteamProfileData | null; steamBan?: BanEntry | null; pending?: boolean }) {
  // With the VAC ban from Steam: one badge per kind, VAC first.
  const vac: BanEntry[] = steamBan !== undefined ? (steamBan ? [steamBan] : []) : steam?.vacBanned ? [{ kind: "vac", reason: t.vacBanned, at: null, dateText: "", length: "", until: null }] : [];
  const bans = mergeBans([...found, ...vac].map((ban) => ({ player: 0, ban })), () => 0)[0]?.bans ?? [];
  // VAC and SourceBans side by side when the site checks them (grey when not banned there).
  const always: BanKind[] = [...(steam ? (["vac"] as const) : []), ...(sourcebans ? (["sourcebans"] as const) : [])];
  // As on gameME: the name runs across the full width, the avatar sits in
  // its own framed box beside the seven rows from Clan to Steam name (they
  // are always there, with or without Steam data) and the rows below use
  // the full width again.
  const avatar = (
    <td rowSpan={7} className="avatar-cell">
      {steam?.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={steam.avatar} alt={steam.name ?? ""} width={184} height={184} referrerPolicy="no-referrer" />
      ) : (
        <span className="avatar-none" aria-hidden="true">
          {(p.name ?? "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?"}
        </span>
      )}
    </td>
  );
  return (
    <table className="stats profile">
      <thead>
        <tr>
          <th colSpan={3}>{t.playerProfile}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="stats-key">{t.name}:</td>
          <td colSpan={2}>
            <b>
              <Flag code={p.flag} title={p.country} />
              {p.name ?? `#${id}`}
              <NameBanMark bans={bans} t={t} lang={lang} />
            </b>
            {stars && stars.gold + stars.silver + stars.bronze ? (
              <Link prefetch={false} href={`/${game}/hall-of-fame`} className="hof-profile-stars">
                <HallStars gold={stars.gold} silver={stars.silver} bronze={stars.bronze} label={fill(t.hofStarsTip, { gold: stars.gold, silver: stars.silver, bronze: stars.bronze })} />
              </Link>
            ) : null}
          </td>
        </tr>
        <Row k={t.clan} v={p.clanTag ? <Link prefetch={false} href={`/${game}/clans/${p.clan}`}>{p.clanTag}</Link> : <i>{t.none}</i>} aside={avatar} />
        <Row k={t.location} v={location.length ? <>{location}</> : <i>{t.notSpecified}</i>} />
        <Row k={t.playerId} v={fmtNum(id, lang)} />
        <Row k={t.steamId} v={isBot ? t.bot : (ids?.steam2 ?? p.uniqueId ?? "-")} />
        <Row k="Steam ID3" v={ids?.steam3 ?? "-"} />
        <Row
          k={t.steamProfile}
          v={
            ids ? (
              <a href={`https://steamcommunity.com/profiles/${ids.steam64}`} rel="noopener noreferrer" target="_blank">
                {ids.steam64}
              </a>
            ) : (
              "-"
            )
          }
        />
        <Row k={t.steamName} v={steam?.name ?? <i>{pending ? "…" : t.notSpecified}</i>} />
        {steam?.memberSince ? <Row k={t.memberSince} v={memberDate(steam.memberSince, lang)} span /> : null}
        {bans.length || steam ? (
          <Row
            k={t.bans}
            v={
              <span className="ban-info">
                {bans.length ? (
                  <BanBadges bans={bans} always={always} links={{ sourcebans: sourcebansSearchUrl(sourcebansUrl, ids?.steam2) }} t={t} lang={lang} />
                ) : (
                  <>
                    VAC: <span className="good">{t.vacClean}</span>
                  </>
                )}
              </span>
            }
            span
          />
        ) : null}
        <Row k={t.lastConnect} v={`${age ?? fmtDateTime(p.last_event, lang)} (${fmtNum(p.total_connects, lang)} ${t.connections})`} span />
        <Row k={t.firstConnect} v={fmtDateTime(p.first_connect, lang)} span />
        <Row k={t.playTime} v={fmtDuration(p.connection_time)} span />
        <Row k={t.avgPing} v={p.average_ping ? `${p.average_ping} ms` : "-"} span />
        <Row
          k={t.favWeapon}
          v={fav ? <Link prefetch={false} href={`/${game}/weapons/${encodeURIComponent(fav.code)}`}>{fav.name}</Link> : "-"}
          span
        />
      </tbody>
    </table>
  );
}

// aside: a cell after the value that spans the following rows (the avatar).
function Row({ k, v, span = false, aside }: { k: string; v: React.ReactNode; span?: boolean; aside?: React.ReactNode }) {
  return (
    <tr>
      <td className="stats-key">{k}:</td>
      <td colSpan={span ? 2 : 1}>{v}</td>
      {aside}
    </tr>
  );
}

function Row4({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={4} className="stats-key">
        {k}:
      </td>
      <td colSpan={2}>{v}</td>
    </tr>
  );
}

// Index of the hitbox weapon from ?hw=, 0 (all weapons) if missing or out of range.
function hwParam(v: string | string[] | undefined, n: number): number {
  const i = Number.parseInt(Array.isArray(v) ? (v[0] ?? "") : (v ?? ""), 10);
  return Number.isInteger(i) && i >= 0 && i < n ? i : 0;
}
