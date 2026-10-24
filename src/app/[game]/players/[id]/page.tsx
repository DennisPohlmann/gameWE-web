import type { Metadata } from "next";
import { ShareBar } from "@/components/share-menu";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bar, Empty, Flag, PctBar, PlayerLink, Section, TableWrap } from "@/components/ui";
import { SortableTable } from "@/components/sortable-table";
import { RankBadge, Ribbon, RibbonLevel, rankName, ribbonClassName } from "@/components/badges";
import { Radar, Spark, TrendChart } from "@/components/graphics";
import { Hitbox } from "@/components/hitbox";
import { SigCode } from "@/components/sig-code";
import { ZONES } from "@/lib/zones";
import { awardValue, getAwards, getPlayerRibbons, getRanks, getRibbonClasses, rankFor, ribbonFor, ribbonProgress } from "@/lib/awards";
import { siteDay } from "@/lib/day";
import { getSteamProfile } from "@/lib/steam";
import { PlayerLinks, historyAccess } from "@/components/player-history";
import { signatureUrl } from "@/lib/site-url";
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
  getPlayerFrags,
  getPlayerHistory,
  getPlayerMaps,
  getPlayerNames,
  getPlayerPosition,
  getPlayerTeams,
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
  if (!p) return { title: `#${id}` };
  const [{ lang, t }, { siteName }, position, image] = await Promise.all([
    getDict(),
    getSettings(),
    p.hideranking ? Promise.resolve(null) : getPlayerPosition(p.game, p.skill),
    signatureUrl(p.playerId),
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
  if (!p) notFound();
  if (p.game !== game) redirect(`/${p.game}/players/${id}`);

  const { lang, t } = await getDict();
  const [settings, access] = await Promise.all([getSettings(), historyAccess()]);
  const ids = steamIds(p.uniqueId);
  const [position, history, names, weapons, maps, teams, actions, frags, victims, killers, killStats, awards, ranks, chat, steam, ribbons, allAwards, classes, sigUrl] =
    await Promise.all([
      p.hideranking ? Promise.resolve(null) : getPlayerPosition(game, p.skill),
      getPlayerHistory(id, 30),
      getPlayerNames(id),
      getPlayerWeapons(id),
      getPlayerMaps(id),
      getPlayerTeams(id),
      getPlayerActions(id),
      getPlayerFrags(id, 25),
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
      signatureUrl(id),
    ]);
  const imgStyles = await imageStyles(lang === "de" ? "de" : "en");
  const flags = await getPlayerFlags([
    ...frags.flatMap((f) => [f.victimId, f.killerId]),
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
  const sparkTitles = { total: t.total, current: `${t.current} ${t.last14}`, min: t.min, max: t.max };
  const n2 = (v: number | null) => fmtNum(v, lang, 2);
  const pc = (v: number | null) => fmtPct(v, lang);
  const kpm = (kills: number, secs: number) => (secs > 0 ? kills / (secs / 60) : 0);
  const radar = [
    { label: t.kpd, total: kpd(p.kills, p.deaths) / 3, current: kpdNow / 3, text: n2(kpd(p.kills, p.deaths)) },
    { label: t.kpm, total: kpm(p.kills, p.connection_time) / 2, current: kpm(kills14, sum14("connection_time")) / 2, text: n2(kpm(p.kills, p.connection_time)) },
    { label: t.assists, total: (ratio(p.kill_assists, p.kills) ?? 0) * 2, current: (ratio(sum14("kill_assists"), kills14) ?? 0) * 2, text: fmtNum(p.kill_assists, lang) },
    { label: t.survived, total: ratio(p.survived_count, p.rounds) ?? 0, current: ratio(sum14("survived_count"), sum14("rounds")) ?? 0, text: pc(ratio(p.survived_count, p.rounds)) },
    { label: t.winRatioShort, total: ratio(p.wins, p.rounds) ?? 0, current: ratio(sum14("wins"), sum14("rounds")) ?? 0, text: pc(ratio(p.wins, p.rounds)) },
  ];
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
                <th colSpan={4}>{t.playerSummary}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="stats-key">{t.position}:</td>
                <td>
                  <b>{position ? fmtNum(position, lang) : "-"}</b> · {t.points}: <b>{fmtNum(p.skill, lang)}</b>{" "}
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
                <td colSpan={2} rowSpan={7} className="radar-cell">
                  <Radar axes={radar} labels={{ total: t.total, current: `${t.current} ${t.last14}` }} />
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
                  <Spark values={kpdDays} total={n2(kpd(p.kills, p.deaths))} current={n2(kpdNow)} min={n2(kpdDays.length ? Math.min(...kpdDays) : null)} max={n2(kpdDays.length ? Math.max(...kpdDays) : null)} titles={sparkTitles} />
                </td>
              </tr>
              <tr>
                <td className="stats-key">{t.hpkLong}:</td>
                <td>
                  <Spark values={hpkDays} total={pc(ratio(p.headshots, p.kills))} current={pc(hpkNow)} min={pc(hpkDays.length ? Math.min(...hpkDays) : null)} max={pc(hpkDays.length ? Math.max(...hpkDays) : null)} titles={sparkTitles} />
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
                v={<Spark values={accDays} total={pc(ratio(p.hits, p.shots))} current={pc(accNow)} min={pc(accDays.length ? Math.min(...accDays) : null)} max={pc(accDays.length ? Math.max(...accDays) : null)} titles={sparkTitles} />}
              />
              <Row4
                k={t.shotsPerKill}
                v={<Spark values={spkDays} total={n2(p.kills && p.shots ? p.shots / p.kills : null)} current={n2(spkNow)} min={n2(spkDays.length ? Math.min(...spkDays) : null)} max={n2(spkDays.length ? Math.max(...spkDays) : null)} titles={sparkTitles} />}
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
                  <th>{t.playerTrend}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="center">
                    {history.length ? (
                      <TrendChart
                        days={history.map((h) => ({ day: h.eventTime.slice(0, 10), skill: h.skill, change: h.skill_change }))}
                        locale={lang}
                        labels={{ points: t.points, gained: t.skillGained, lost: t.skillLost }}
                      />
                    ) : (
                      <span className="muted">{t.noData}</span>
                    )}
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
                      link={sigUrl.replace(/\/sig\/.*$/, `/${game}/players/${id}`)}
                      alt={`${t.forumSignature}: ${p.name ?? id}`}
                      width={400}
                      height={100}
                      labels={{ format: t.sigFormat, style: t.imgStyle, standard: t.imgStandard, url: t.sigImageUrl, copy: t.copy, copied: t.copied }}
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
              <table>
                <thead>
                  <tr>
                    <th>{t.team}</th>
                    <th className="num">{t.joined}</th>
                    <th className="barcell">{t.share}</th>
                  </tr>
                </thead>
                <tbody>
                  {teams.map((x) => (
                    <tr key={x.id}>
                      <td>{x.name}</td>
                      <td className="num">{fmtNum(x.joined, lang)}</td>
                      <td className="barcell">
                        <Bar value={ratio(x.joined, totalTeamJoins)} label={fmtPct(ratio(x.joined, totalTeamJoins), lang)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        ) : null}

        {actions.length ? (
          <Section title={t.actions}>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t.actions}</th>
                    <th className="num">{t.count}</th>
                    <th className="num">{t.reward}</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/${game}/actions/${a.id}`}>{a.description}</Link>
                      </td>
                      <td className="num">{fmtNum(a.count, lang)}</td>
                      <td className="num">{fmtNum(a.points, lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        ) : null}

        {maps.length ? (
          <Section title={t.maps}>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t.map}</th>
                    <th className="num">{t.kills}</th>
                    <th className="num">{t.deaths}</th>
                    <th className="num">{t.kpd}</th>
                    <th className="num">{t.hpk}</th>
                  </tr>
                </thead>
                <tbody>
                  {maps.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link href={`/${game}/maps/${m.id}`}>{m.map}</Link>
                      </td>
                      <td className="num">{fmtNum(m.kills, lang)}</td>
                      <td className="num">{fmtNum(m.deaths, lang)}</td>
                      <td className="num">{fmtNum(kpd(m.kills, m.deaths), lang, 2)}</td>
                      <td className="num">{fmtPct(ratio(m.headshots, m.kills), lang)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableWrap>
          </Section>
        ) : null}

        {victims.length ? <OpponentTable title={t.victims} rows={victims} game={game} t={t} lang={lang} flags={flags} /> : null}
        {killers.length ? <OpponentTable title={t.killers} rows={killers} game={game} t={t} lang={lang} flags={flags} /> : null}
      </div>

      {frags.length ? (
        <Section title={t.recentKills}>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th>{t.date}</th>
                  <th>{t.kills}</th>
                  <th>{t.weapons}</th>
                  <th className="hide-sm">{t.map}</th>
                </tr>
              </thead>
              <tbody>
                {frags.map((f, i) => {
                  const mine = f.killerId === id;
                  return (
                    <tr key={i}>
                      <td className="muted">{fmtDateTime(f.timestamp_id, lang)}</td>
                      <td>
                        {mine ? (
                          <>
                            <span className="good">{t.killed}</span>{" "}
                            <PlayerLink game={game} id={f.victimId} name={f.victimName} flag={flags.get(f.victimId)} />
                          </>
                        ) : (
                          <>
                            <span className="bad">{t.killedBy}</span>{" "}
                            <PlayerLink game={game} id={f.killerId} name={f.killerName} flag={flags.get(f.killerId)} />
                          </>
                        )}
                      </td>
                      <td>
                        {f.weapon ?? "-"}
                        {f.headshot ? <span className="hs" title="Headshot">HS</span> : null}
                      </td>
                      <td className="hide-sm">{f.map ?? "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableWrap>
        </Section>
      ) : null}

      <div className="grid-2">
        {names.length ? (
          <Section title={t.names}>
            <TableWrap>
              <table>
                <thead>
                  <tr>
                    <th>{t.name}</th>
                    <th className="num">{t.time}</th>
                    <th className="num">{t.kills}</th>
                    <th className="num hide-sm">{t.lastUse}</th>
                  </tr>
                </thead>
                <tbody>
                  {names.map((n) => (
                    <tr key={n.name}>
                      <td>{n.name}</td>
                      <td className="num">{fmtDuration(n.connection_time)}</td>
                      <td className="num">{fmtNum(n.kills, lang)}</td>
                      <td className="num hide-sm">{n.lastuse ? `${n.lastuse.slice(0, 16)} UTC` : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
                      <td className="muted">{fmtDateTime(c.timestamp_id, lang)}</td>
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

      {!weapons.length && !frags.length && !history.length ? <Empty>{t.noData}</Empty> : null}
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
        <table>
          <thead>
            <tr>
              <th>{t.player}</th>
              <th className="num">{t.kills}</th>
              <th className="num">{t.hpk}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.playerId}>
                <td>
                  <PlayerLink game={game} id={o.playerId} name={o.name} flag={flags.get(o.playerId)} />
                </td>
                <td className="num">{fmtNum(o.kills, lang)}</td>
                <td className="num">{fmtPct(ratio(o.headshots, o.kills), lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <td colSpan={2} className="stats-key">
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
