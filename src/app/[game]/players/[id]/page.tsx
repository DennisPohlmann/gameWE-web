import type { Metadata } from "next";
import { ShareBar } from "@/components/share-menu";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bar, Empty, Flag, PctBar, PlayerLink, Section, TableWrap } from "@/components/ui";
import { SortableTable } from "@/components/sortable-table";
import { RankBadge, Ribbon, RibbonLevel, rankName, ribbonClassName } from "@/components/badges";
import { Spark } from "@/components/graphics";
import { PlayerTrend } from "@/components/player-trend";
import { Radar, type RadarAxis } from "@/components/radar";
import { FIXED_MAX, radarPoints, type PlayerRatios, type RadarKey } from "@/lib/radar";
import { Hitbox } from "@/components/hitbox";
import { SigCode } from "@/components/sig-code";
import { PlayerEvents } from "@/components/game-events";
import { ZONES } from "@/lib/zones";
import { awardValue, getAwards, getPlayerRibbons, getRanks, getRibbonClasses, rankFor, ribbonFor, ribbonProgress } from "@/lib/awards";
import { siteDay } from "@/lib/day";
import { getSteamProfile } from "@/lib/steam";
import { PlayerLinks, historyAccess } from "@/components/player-history";
import { bannerUrl, statsOrigin } from "@/lib/site-url";
import { shareMetadata } from "@/lib/share-meta";
import { imageStyles } from "@/lib/image-theme";
import { getSettings } from "@/lib/settings";
import { placeHref } from "@/components/ranking";
import {
  getChat,
  getOpponents,
  getPlayerKillStats,
  getPlayer,
  getPlayerActions,
  getPlayerAwards,
  getPlayerFlags,
  noProfile,
  getPlayerHistory,
  getPlayerSkillBefore,
  getPlayerMaps,
  getPlayerNames,
  getPlayerPosition,
  getPlayerTeams,
  getRadarRanks,
  getPlayerWeapons,
} from "@/lib/data";
import { activity, fmtAge, fmtDateTime, fmtDuration, fmtNum, fmtPct, kpd, ratio, steamIds } from "@/lib/format";
import { fill, getDict } from "@/lib/i18n";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function playerId(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const id = playerId((await params).id);
  const p = id ? await getPlayer(id) : undefined;
  if (!p || (await noProfile(p))) return { title: `#${id}` };
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
  if (!p || (await noProfile(p))) notFound();
  if (p.game !== game) redirect(`/${p.game}/players/${id}`);

  const { lang, t } = await getDict();
  const [settings, access] = await Promise.all([getSettings(), historyAccess()]);
  const ids = steamIds(p.uniqueId);
  const [position, history, names, weapons, maps, teams, actions, victims, killers, killStats, awards, ranks, chat, steam, ribbons, allAwards, classes, sigUrl, origin, skillBefore] =
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
      ids ? getSteamProfile(ids.steam64) : Promise.resolve(null),
      getPlayerRibbons(id),
      getAwards(game),
      getRibbonClasses(game),
      bannerUrl(game, "player", id),
      statsOrigin(),
      getPlayerSkillBefore(id, 30),
    ]);
  const imgStyles = await imageStyles(lang === "de" ? "de" : "en");
  const flags = await getPlayerFlags([
    ...victims.map((o) => o.playerId),
    ...killers.map((o) => o.playerId),
    ...killStats.map((o) => o.playerId),
  ]);
  // Hidden players stay out of the list; bots are shown with their tag.
  const killList = killStats.filter((o) => o.hideranking === 0 || flags.get(o.playerId)?.flag === "bot");

  const last14 = history.filter((h) => h.eventTime >= siteDay(-13));

  const kills14 = last14.reduce((s, h) => s + h.kills, 0);
  const hs14 = last14.reduce((s, h) => s + h.headshots, 0);
  const isBot = (p.uniqueId ?? "").startsWith("BOT");
  const fav = weapons[0];
  const rank = rankFor(p.kills, ranks);
  const rankProgress = rank && rank.next !== null ? (p.kills - rank.minimum) / (rank.next - rank.minimum) : 1;
  // City and country link to the ranking of that place.
  const code = /^[a-z]{2}$/i.test(p.flag ?? "") ? (p.flag as string) : "";
  const location = [
    p.city ? (code ? <Link key="c" href={placeHref(game, code, p.city)}>{p.city}</Link> : p.city) : null,
    p.state,
    p.country ? (code ? <Link key="l" href={placeHref(game, code)}>{p.country}</Link> : p.country) : null,
  ]
    .filter(Boolean)
    .flatMap((x, i) => (i ? [", ", x] : [x]));
  const age = fmtAge(p.last_event, lang);
  const totalTeamJoins = teams.reduce((s, x) => s + x.joined, 0);
  const totalWeaponKills = weapons.reduce((s, w) => s + w.kills, 0);
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
  // Radar: each axis as a ratio, all time and the last two weeks; radar.ts
  // turns them into percentiles among the game's players and drops axes the
  // game does not record.
  const radarRatios: PlayerRatios = {
    kpd: { total: { num: p.kills, den: p.deaths }, current: last14.length ? { num: kills14, den: sum14("deaths") } : null },
    kpm: { total: { num: p.kills, den: p.connection_time }, current: { num: kills14, den: sum14("connection_time") } },
    assists: { total: { num: p.kill_assists, den: p.kills }, current: { num: sum14("kill_assists"), den: kills14 } },
    survived: { total: { num: p.survived_count, den: p.rounds }, current: { num: sum14("survived_count"), den: sum14("rounds") } },
    wins: { total: { num: p.wins, den: p.rounds }, current: { num: sum14("wins"), den: sum14("rounds") } },
  };
  const radarRanks = await getRadarRanks(game, radarRatios);
  const radarPts = radarPoints(radarRatios, radarRanks);
  const radarLabel: Record<RadarKey, string> = { kpd: t.kpd, kpm: t.kpm, assists: t.assists, survived: t.survived, wins: t.winRatioShort };
  const radarValue = (key: RadarKey, v: number, count: number) =>
    key === "survived" || key === "wins" ? pc(v) : key === "assists" ? `${n2(v)} ${t.perKill} (${fmtNum(count, lang)})` : n2(v);
  const radarScale = (key: RadarKey, pct: number | null) =>
    pct !== null ? fill(t.radarBetter, { pct: pc(pct) }) : fill(t.radarScale, { max: fmtNum(FIXED_MAX[key], lang, key === "assists" ? 1 : 0) });
  const radar: RadarAxis[] = radarPts.map((a) => ({
    label: radarLabel[a.key],
    total: a.rTotal,
    current: a.rCurrent,
    totalText: radarValue(a.key, a.total, p.kill_assists),
    currentText: a.current === null ? "—" : radarValue(a.key, a.current, sum14("kill_assists")),
    totalScale: radarScale(a.key, a.pctTotal),
    currentScale: a.current === null ? "" : radarScale(a.key, a.pctCurrent),
  }));
  const radarN = Math.max(0, ...radarPts.filter((a) => a.pctTotal !== null).map((a) => radarRanks[a.key]?.n ?? 0));
  const radarNote = radarN ? fill(t.radarCompared, { n: fmtNum(radarN, lang) }) : undefined;
  const wonAwards = new Map(ribbons.map((r) => [r.awardId, r.wins]));
  const totalRibbonWins = ribbons.reduce((n, r) => n + r.wins, 0);

  return (
    <>
      <div className="page-share">
        <ShareBar labels={{ share: t.shareThis, copy: t.shareCopy, copied: t.copied, email: t.shareEmail }} />
      </div>
      {p.hideranking ? <p className="notice">{Number(p.hideranking) === 3 ? t.hiddenBySelf : t.hidden}</p> : null}

      <Section title={t.playerInfo}>
        <div className="cont-2">
          <table className="stats profile">
            <thead>
              <tr>
                <th colSpan={3}>{t.playerProfile}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="stats-key">{t.name}:</td>
                <td>
                  <b>
                    <Flag code={p.flag} title={p.country} />
                    {p.name ?? `#${id}`}
                  </b>
                </td>
                <td rowSpan={8} className="avatar-cell">
                  {steam?.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={steam.avatar} alt={steam.name ?? ""} width={184} height={184} referrerPolicy="no-referrer" />
                  ) : (
                    <span className="avatar-none" aria-hidden="true">
                      {(p.name ?? "").replace(/[^\p{L}\p{N}]/gu, "").slice(0, 1).toUpperCase() || "?"}
                    </span>
                  )}
                </td>
              </tr>
              <Row k={t.clan} v={p.clanTag ? <Link href={`/${game}/clans/${p.clan}`}>{p.clanTag}</Link> : <i>{t.none}</i>} />
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
              <Row k={t.steamName} v={steam?.name ?? <i>{t.notSpecified}</i>} />
              {steam?.memberSince ? <Row k={t.memberSince} v={steam.memberSince} span /> : null}
              {steam ? <Row k="VAC" v={steam.vacBanned ? <span className="bad">{t.vacBanned}</span> : <span className="good">{t.vacClean}</span>} span /> : null}
              <Row k={t.lastConnect} v={`${age ?? fmtDateTime(p.last_event, lang)} (${fmtNum(p.total_connects, lang)} ${t.connections})`} span />
              <Row k={t.firstConnect} v={fmtDateTime(p.first_connect, lang)} span />
              <Row k={t.playTime} v={fmtDuration(p.connection_time)} span />
              <Row k={t.avgPing} v={p.average_ping ? `${p.average_ping} ms` : "-"} span />
              <Row
                k={t.favWeapon}
                v={fav ? <Link href={`/${game}/weapons/${encodeURIComponent(fav.code)}`}>{fav.name}</Link> : "-"}
                span
              />
            </tbody>
          </table>

          {/* Summary and the history links below it share the right column. */}
          <div>
          <table className="stats summary">
            <thead>
              <tr>
                <th colSpan={6}>{t.playerSummary}</th>
              </tr>
            </thead>
            <tbody>
              {/* Six columns: the left half holds position and points as two
                  label/value pairs, the radar and the full-width rows span it. */}
              <tr>
                <td className="stats-key pair">{t.position}:</td>
                <td className="pair-value">
                  <b>{position ? fmtNum(position, lang) : "-"}</b>
                </td>
                <td className="stats-key pair">{t.points}:</td>
                <td className="pair-value">
                  <b>{fmtNum(p.skill, lang)}</b>{" "}
                  <span className={p.last_skill_change >= 0 ? "good" : "bad"}>
                    ({p.last_skill_change > 0 ? "+" : ""}
                    {fmtNum(p.last_skill_change, lang)})
                  </span>
                </td>
                <td className="stats-key">{t.activity}:</td>
                <td className="barcell">
                  <Bar value={activity(p.last_event, settings.activityDays) / 100} activity label={`${activity(p.last_event, settings.activityDays)} %`} />
                </td>
              </tr>
              <tr>
                <td colSpan={4} rowSpan={7} className="radar-cell">
                  <Radar axes={radar} labels={{ total: t.total, current: `${t.current} (${days14})` }} note={radarNote} />
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
              <Row4 k={t.assists} v={`${fmtNum(p.kill_assists, lang)} (${t.kills}: ${fmtNum(p.kills_assisted, lang)})`} />
              {/* Rounds count only with a winner: servers without win triggers (GunGame, DM) have none. */}
              <Row4 k={t.rounds} v={p.rounds ? `${fmtNum(p.rounds, lang)} (${t.wins}: ${fmtNum(p.wins, lang)}, ${t.losses}: ${fmtNum(p.losses, lang)})` : "—"} />
              <Row4 k={t.winRatio} v={p.rounds ? <Bar value={ratio(p.wins, p.rounds)} green label={pc(ratio(p.wins, p.rounds))} /> : "—"} />
              <Row4 k={t.survived} v={p.rounds ? `${fmtNum(p.survived_count, lang)} ${t.rounds} (${pc(ratio(p.survived_count, p.rounds))})` : "—"} />
              <Row4 k={t.teamkills} v={fmtNum(p.team_kills, lang)} />
              <Row4
                k={t.acc}
                v={<Spark values={accDays} total={ratio(p.hits, p.shots)} current={accNow} fmt={pc} titles={sparkTitles} />}
              />
              <Row4
                k={t.shotsPerKill}
                v={<Spark values={spkDays} total={p.kills && p.shots ? p.shots / p.kills : null} current={spkNow} fmt={n2} titles={sparkTitles} lowerIsBetter />}
              />
              <Row4 k={t.killStreak} v={fmtNum(p.kill_streak, lang)} />
            </tbody>
          </table>
          <PlayerLinks game={game} id={id} name={p.name} t={t} />
          </div>
        </div>
        <p className="footnote">{t.last14}</p>
      </Section>

      <Section title={t.playerStats}>
        <div className="cont-2">
          <div>
            <table className="stats">
              <thead>
                <tr>
                  <th>
                    {t.playerTrend} (
                    <Link className="th-link" href={`/${game}/players/${id}/sessions`}>
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
                      <Link href={`/${game}/awards?view=ranks&rank=${rank.index}`}>
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
                      {t.career} (<Link href={`/${game}/awards?view=ranks`}>{t.ranksOverview}</Link>)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="career">
                      {ranks.map((r) => (
                        <RankBadge key={r.index} name={r.name} size={40} dim={p.kills < r.minimum} />
                      ))}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : null}
          </div>
          <div>
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
            {allAwards.length ? (
              <table className="stats spaced">
                <thead>
                  <tr>
                    <th>
                      {t.ribbons} ({fill(t.winsCount, { n: totalRibbonWins })}, <Link href={`/${game}/awards?view=ribbons`}>{t.ribbonsOverview}</Link>)
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
                            <Link key={a.awardId} href={`/${game}/awards?view=ribbons&award=${a.awardId}`}>
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

      {hitboxWeapons[0] && ZONES.some((z) => hitboxWeapons[0].hits[z] > 0) ? (
        <Section title={t.hitbox}>
          <div className="cont-2">
            <div className="box">
              <Hitbox
                weapons={hitboxWeapons}
                locale={lang}
                labels={{
                  head: t.head,
                  chest: t.chest,
                  stomach: t.stomach,
                  leftarm: t.leftarm,
                  rightarm: t.rightarm,
                  leftleg: t.leftleg,
                  rightleg: t.rightleg,
                  weapon: t.weapon,
                  hits: t.hits,
                  show: t.show,
                }}
                initial={hwParam((await searchParams).hw, hitboxWeapons.length)}
              />
            </div>
            {/* Keeps the hitbox in the left column. */}
            <div />
          </div>
        </Section>
      ) : null}

      {weapons.length ? (
        <Section title={t.weapons}>
          <TableWrap>
            <SortableTable
              initial={4}
              cols={[
                { label: t.weapon },
                { label: t.shots, className: "num hide-sm" },
                { label: t.hits, className: "num hide-sm" },
                { label: t.damage, className: "num hide-sm" },
                { label: t.kills, className: "num" },
                { label: t.deaths, className: "num hide-sm" },
                { label: t.kpd, className: "num" },
                { label: t.hs, className: "num hide-sm" },
                { label: t.hpk, className: "barcell" },
                { label: t.acc, className: "barcell" },
                { label: <abbr title={t.dphTitle}>{t.dph}</abbr>, className: "num hide-sm" },
                { label: <abbr title={t.spkTitle}>{t.spk}</abbr>, className: "num hide-sm" },
              ]}
              rows={weapons.map((w) => {
                const hpk = ratio(w.headshots, w.kills);
                const acc = ratio(w.hits, w.shots);
                const dph = w.hits ? w.damage / w.hits : null;
                const spk = w.kills ? w.shots / w.kills : null;
                return {
                  key: w.weaponId,
                  values: [w.name, w.shots, w.hits, w.damage, w.kills, w.deaths, kpd(w.kills, w.deaths), w.headshots, hpk, acc, dph, spk],
                  cells: [
                    <Link key="n" href={`/${game}/weapons/${encodeURIComponent(w.code)}`}>
                      {w.name}
                    </Link>,
                    fmtNum(w.shots, lang),
                    fmtNum(w.hits, lang),
                    fmtNum(w.damage, lang),
                    fmtNum(w.kills, lang),
                    fmtNum(w.deaths, lang),
                    fmtNum(kpd(w.kills, w.deaths), lang, 2),
                    fmtNum(w.headshots, lang),
                    <PctBar key="h" value={hpk} lang={lang} />,
                    <PctBar key="a" value={acc} lang={lang} />,
                    dph === null ? "-" : fmtNum(dph, lang, 2),
                    spk === null ? "-" : fmtNum(spk, lang, 2),
                  ],
                };
              })}
            />
          </TableWrap>
        </Section>
      ) : null}

      <div className="grid-2">
        {teams.length ? (
          <Section title={t.teams}>
            <TableWrap>
              <SortableTable
                initial={1}
                cols={[{ label: t.team }, { label: t.joined, className: "num" }, { label: t.share, className: "barcell", noSort: true }]}
                rows={teams.map((x) => ({
                  key: x.id,
                  values: [x.name, x.joined, null],
                  cells: [x.name, fmtNum(x.joined, lang), <Bar key="s" value={ratio(x.joined, totalTeamJoins)} label={fmtPct(ratio(x.joined, totalTeamJoins), lang)} />],
                }))}
              />
            </TableWrap>
          </Section>
        ) : null}

        {actions.length ? (
          <Section title={t.actions}>
            <TableWrap>
              <SortableTable
                initial={1}
                cols={[{ label: t.actions }, { label: t.count, className: "num" }, { label: t.reward, className: "num" }]}
                rows={actions.map((a) => ({
                  key: a.id,
                  values: [a.description, a.count, a.points],
                  cells: [
                    <Link key="a" href={`/${game}/actions/${a.id}`}>
                      {a.description}
                    </Link>,
                    fmtNum(a.count, lang),
                    fmtNum(a.points, lang),
                  ],
                }))}
              />
            </TableWrap>
          </Section>
        ) : null}

        {maps.length ? (
          <Section title={t.maps}>
            <TableWrap>
              <SortableTable
                initial={1}
                cols={[{ label: t.map }, { label: t.kills, className: "num" }, { label: t.deaths, className: "num" }, { label: t.kpd, className: "num" }, { label: t.hpk, className: "num" }]}
                rows={maps.map((m) => ({
                  key: m.id,
                  values: [m.map, m.kills, m.deaths, kpd(m.kills, m.deaths), ratio(m.headshots, m.kills)],
                  cells: [
                    <Link key="m" href={`/${game}/maps/${m.id}`}>
                      {m.map}
                    </Link>,
                    fmtNum(m.kills, lang),
                    fmtNum(m.deaths, lang),
                    fmtNum(kpd(m.kills, m.deaths), lang, 2),
                    fmtPct(ratio(m.headshots, m.kills), lang),
                  ],
                }))}
              />
            </TableWrap>
          </Section>
        ) : null}

        {victims.length ? <OpponentTable title={t.victims} rows={victims} game={game} t={t} lang={lang} flags={flags} /> : null}
        {killers.length ? <OpponentTable title={t.killers} rows={killers} game={game} t={t} lang={lang} flags={flags} /> : null}
      </div>

      <PlayerEvents game={game} playerId={id} t={t} lang={lang} />

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

function Row({ k, v, span = false }: { k: string; v: React.ReactNode; span?: boolean }) {
  return (
    <tr>
      <td className="stats-key">{k}:</td>
      <td colSpan={span ? 2 : 1}>{v}</td>
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
