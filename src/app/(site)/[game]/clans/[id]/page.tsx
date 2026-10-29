import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ClanEvents } from "@/components/game-events";
import { Spark } from "@/components/graphics";
import { MapTable, WeaponStats, WeaponUsage, targetLabels } from "@/components/usage-tables";
import { WeaponTargets } from "@/components/weapon-targets";
import { MapGate } from "@/components/map-gate";
import { Radar, type RadarAxis } from "@/components/radar";
import { RankingTable, rankingValues } from "@/components/ranking";
import { Bar, Flag, Section, Stats } from "@/components/ui";
import { mapGateProps } from "@/lib/consent-server";
import { gameHasShots, getClan, getClanFlags, getClanMapPlayers, getClanMembers, getInactiveClanMembers, getMembersHistory, getMembersMaps, getMembersWeapons, getRadarAverage } from "@/lib/data";
import { siteDay } from "@/lib/day";
import { FIXED_MAX, radarPoints, type PlayerRatios, type RadarKey } from "@/lib/radar";
import { ZONES } from "@/lib/zones";
import { countryName, fmtDate, fmtDuration, fmtNum, fmtPct, kpd, ratio } from "@/lib/format";
import { mapMarkers } from "@/lib/map-markers";
import { fill, getDict, type Dict, type Lang } from "@/lib/i18n";
import { shareMetadata } from "@/lib/share-meta";
import { getSettings } from "@/lib/settings";
import { sortRows, sortState } from "@/lib/table-sort";

type Props = { params: Promise<{ game: string; id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

async function load(raw: string) {
  const id = Number.parseInt(raw, 10);
  return Number.isSafeInteger(id) && id > 0 ? getClan(id) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const c = await load((await params).id);
  if (!c) return {};
  const [{ lang, t }, { siteName }] = await Promise.all([getDict(), getSettings()]);
  const name = c.name && c.name !== c.tag ? `${c.tag} ${c.name}` : c.tag;
  return shareMetadata({ title: c.tag, page: `${t.clans}: ${c.tag}`, text: fill(t.shareTextClan, { name, site: siteName, members: fmtNum(c.members, lang) }) });
}

export default async function ClanPage({ params, searchParams }: Props) {
  const { game, id } = await params;
  const c = await load(id);
  if (!c) notFound();
  if (c.game !== game) redirect(`/${c.game}/clans/${c.clanId}`);
  const { lang, t } = await getDict();
  const [members, gone, settings] = await Promise.all([getClanMembers(c.clanId), getInactiveClanMembers(c.clanId), getSettings()]);
  // The map shows every member with a known place, active or not, where the
  // ranking shows its player map.
  const [mapPlayers, gate] = settings.mapPlayers
    ? await Promise.all([getClanMapPlayers(game, c.clanId), mapGateProps(settings.mapStyle)])
    : [[], null];
  const markers = mapMarkers(mapPlayers, game, t, lang);
  // A clan with fewer than two active members (an inactive clan, see
  // getInactiveClans) shows the numbers of all its members, like the
  // inactive clans list.
  const inactive = members.length < 2 && gone.length > 0;
  const all = inactive ? [...members, ...gone] : members;
  const sum = (k: "kills" | "deaths" | "headshots" | "connection_time") => all.reduce((s, m) => s + Number(m[k] ?? 0), 0);
  const stats = inactive
    ? {
        members: all.length,
        skill: Math.round(all.reduce((s, m) => s + Number(m.skill ?? 0), 0) / all.length),
        kills: sum("kills"),
        deaths: sum("deaths"),
        headshots: sum("headshots"),
        connection_time: sum("connection_time"),
      }
    : c;
  const flag = (await getClanFlags([c.clanId], inactive)).get(c.clanId);
  // Where the members come from: each country with its number of members,
  // most first.
  const countries = [...[...members, ...gone].reduce((m, r) => {
    const code = (r.flag ?? "").trim().toLowerCase();
    if (code) m.set(code, (m.get(code) ?? 0) + 1);
    return m;
  }, new Map<string, number>())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  // The members the numbers are over (all of them for an inactive clan, as
  // above); the events only of the active ones, who have a ranking row.
  const ids = all.map((m) => Number(m.playerId));
  const [history, weapons, maps, radarAvg, shots] = await Promise.all([
    getMembersHistory(ids, 30),
    getMembersWeapons(ids),
    getMembersMaps(game, ids, 15),
    getRadarAverage(game),
    gameHasShots(game),
  ]);
  const summary = clanSummary({ all, history, radarAvg, shots, t, lang });
  const zoneTotal = (w: (typeof weapons)[number]) => ZONES.reduce((n, z) => n + Number(w[z]), 0);
  const hitboxWeapons = [
    { name: t.allWeapons, hits: Object.fromEntries(ZONES.map((z) => [z, weapons.reduce((n, w) => n + Number(w[z]), 0)])) as Record<(typeof ZONES)[number], number> },
    ...weapons.filter((w) => zoneTotal(w) > 0).map((w) => ({ name: w.name, hits: Object.fromEntries(ZONES.map((z) => [z, Number(w[z])])) as Record<(typeof ZONES)[number], number> })),
  ];
  const sp = await searchParams;
  const order = sortState(await searchParams, rankingValues, "skill");
  const sorted = sortRows(members, rankingValues, order.sort, order.asc);
  // The inactive members follow in the same table, in the same order.
  const goneSorted = sortRows(gone, rankingValues, order.sort, order.asc);
  const base = `/${game}/clans/${c.clanId}`;
  const country = flag?.flag ? countryName(flag.flag, lang) || flag.country : "";
  const details = (
    <Stats
      items={[
        [t.name, <b key="n">{c.name || c.tag}</b>],
        ...(flag?.flag ? ([[t.placeCountry, <span key="c" className="clan-country"><Flag code={flag.flag} title={country} /> {country}</span>]] as [string, React.ReactNode][]) : []),
        ...(countries.length > 1
          ? ([[t.location, <span key="o" className="clan-origins">{countries.map(([code, n]) => <span key={code} className="clan-origin"><Flag code={code} title={countryName(code, lang) || code.toUpperCase()} /> {fmtNum(n, lang)}</span>)}</span>]] as [string, React.ReactNode][])
          : []),
        [t.members, fmtNum(stats.members, lang)],
        [t.avgPoints, fmtNum(stats.skill, lang)],
        [t.kills, fmtNum(stats.kills, lang)],
        [t.deaths, fmtNum(stats.deaths, lang)],
        [t.kpd, fmtNum(kpd(stats.kills ?? 0, stats.deaths ?? 0), lang, 2)],
        [t.hpk, fmtPct(ratio(stats.headshots ?? 0, stats.kills ?? 0), lang)],
        [t.playTime, fmtDuration(stats.connection_time)],
        ...(inactive ? ([[t.lastSeen, fmtDate(Math.max(...all.map((m) => Number(m.last_event ?? 0))), lang)]] as [string, string][]) : []),
      ]}
    />
  );
  const hero = (
    <div className={flag?.flag ? "clan-hero has-flag" : "clan-hero"}>
      {/* The flag lies in the top left corner, the name stands on it in white. */}
      {flag?.flag ? <span className="clan-hero-bg"><Flag code={flag.flag} title={country || undefined} /></span> : null}
      <div className="clan-hero-text">
        <h1>{c.tag}</h1>
        {c.name && c.name !== c.tag ? <p>{c.name}</p> : null}
      </div>
      <ul className="clan-hero-facts">
        <li><b>{fmtNum(stats.members, lang)}</b> {t.members}</li>
        <li><b>{fmtNum(stats.skill, lang)}</b> {t.avgPoints}</li>
      </ul>
    </div>
  );
  return (
    <>
      <Section title={t.clan}>
        {hero}
        {/* Details and the members' summary side by side, as on the player page. */}
        <div className="cont-2 clan-top">
          {details}
          <div className="summary-box">
            {summary.table}
            <p className="footnote">{t.clanSummaryNote}</p>
          </div>
        </div>
      </Section>
      {gate && markers.length ? (
        <Section title={t.clanMap}>
          <div className="box clan-map">
            <MapGate {...gate} markers={markers} style={settings.mapStyle} />
            <p className="muted">{fill(t.clanMapHint, { n: String(markers.length) })}</p>
          </div>
        </Section>
      ) : null}
      <Section title={t.members}>
        <RankingTable
          game={game}
          rows={sorted}
          firstRank={1}
          inactive={{ title: t.inactiveMembers, rows: goneSorted }}
          sort={{ current: order.sort, asc: order.asc, base, params: order.keep }}
          activityDays={settings.activityDays}
          className="clan-members"
          t={t}
          lang={lang}
        />
      </Section>

      {/* The members' maps, weapons and targets in the order and look of
          the player page (gameME's). */}
      {maps.length ? (
        <Section title={t.mapPerformance}>
          <MapTable maps={maps} game={game} t={t} lang={lang} />
        </Section>
      ) : null}

      {weapons.length ? (
        <Section title={t.weaponUsage}>
          <WeaponUsage weapons={weapons} game={game} t={t} lang={lang} members={ids.length} />
        </Section>
      ) : null}

      {hitboxWeapons[0] && ZONES.some((z) => hitboxWeapons[0].hits[z] > 0) ? (
        <Section id="targets" title={t.weaponTargets}>
          <WeaponTargets weapons={hitboxWeapons} locale={lang} labels={targetLabels(t)} initial={hwParam(sp.hw, hitboxWeapons.length)} />
        </Section>
      ) : null}

      {weapons.length ? (
        <Section title={t.weapons}>
          <WeaponStats weapons={weapons} game={game} shots={shots} t={t} lang={lang} />
        </Section>
      ) : null}

      <ClanEvents game={game} clanId={c.clanId} ids={members.map((m) => Number(m.playerId))} t={t} lang={lang} />
    </>
  );
}

// Index of the hitbox weapon from ?hw=, 0 (all weapons) if missing or out of range.
function hwParam(v: string | string[] | undefined, n: number): number {
  const i = Number.parseInt(Array.isArray(v) ? (v[0] ?? "") : (v ?? ""), 10);
  return Number.isInteger(i) && i >= 0 && i < n ? i : 0;
}

// The summary of the members, like the player profile's: totals with the
// average per member, the ratios over all members with their last 30 days
// as a line, and the radar of the clan's last 14 days against all players.
function clanSummary({
  all,
  history,
  radarAvg,
  shots,
  t,
  lang,
}: {
  all: Awaited<ReturnType<typeof getClanMembers>>;
  history: Awaited<ReturnType<typeof getMembersHistory>>;
  radarAvg: Awaited<ReturnType<typeof getRadarAverage>>;
  shots: boolean;
  t: Dict;
  lang: Lang;
}) {
  const n = Math.max(1, all.length);
  const total = (k: "kills" | "deaths" | "headshots" | "shots" | "hits" | "connection_time") => all.reduce((s, m) => s + Number(m[k] ?? 0), 0);
  const [kills, deaths, hs, shotsAll, hits, time] = [total("kills"), total("deaths"), total("headshots"), total("shots"), total("hits"), total("connection_time")];
  const last14 = history.filter((h) => h.eventTime >= siteDay(-13));
  const sum = (rows: typeof history, k: keyof (typeof history)[number]) => rows.reduce((x, h) => x + Number(h[k]), 0);
  const s14 = (k: keyof (typeof history)[number]) => sum(last14, k);
  const s30 = (k: keyof (typeof history)[number]) => sum(history, k);
  const daily = (f: (h: (typeof history)[number]) => number | null) => history.map(f).filter((v): v is number => v !== null && Number.isFinite(v));
  const n2 = (v: number | null) => fmtNum(v, lang, 2);
  const pc = (v: number | null) => fmtPct(v, lang);
  const days14 = t.last14.replace(/^\*\s*/, "");
  const titles = { total: t.total, current: `${t.current} (${days14})`, min: `${t.min} (${t.last30})`, max: `${t.max} (${t.last30})`, days: t.last30 };
  // The total, and after it the average per member, muted.
  const perMember = (total: string, avg: string) => (
    <>
      {total} <span className="muted small per-member" title={t.perMember}>· Ø {avg}</span>
    </>
  );
  const withAvg = (v: number) => perMember(fmtNum(v, lang), fmtNum(v / n, lang));
  // Radar: the clan's last two weeks (all members together) against all
  // players active in them, as on the player page.
  const r14 = (num: number, den: number) => (last14.length ? { num, den } : null);
  const ratios: PlayerRatios = {
    kpd: r14(s14("kills"), s14("deaths")),
    kpm: r14(s14("kills"), s14("connection_time")),
    assists: r14(s14("kill_assists"), s14("kills")),
    survived: r14(s14("survived_count"), s14("rounds")),
    wins: r14(s14("wins"), s14("rounds")),
  };
  const pts = radarPoints(ratios, radarAvg);
  const label: Record<RadarKey, string> = { kpd: t.kpd, kpm: t.kpm, assists: t.assists, survived: t.survived, wins: t.winRatioShort };
  const value = (key: RadarKey, v: number | null) => (v === null ? "—" : key === "survived" || key === "wins" ? pc(v) : key === "assists" ? `${n2(v)} ${t.perKill}` : n2(v));
  const relation = (a: (typeof pts)[number]) => {
    if (a.noData) return t.winNoData;
    if (a.rel === null) return "";
    const d = Math.round((a.rel - 1) * 100) / 100;
    return d === 0 ? t.radarEqual : fill(d > 0 ? t.radarAbove : t.radarBelow, { pct: pc(Math.abs(d)) });
  };
  const radar: RadarAxis[] = pts.map((a) => ({
    label: label[a.key],
    noData: a.noData,
    avg: a.rAvg,
    player: a.r,
    avgText: value(a.key, a.avg),
    playerText: value(a.key, a.value),
    relation: relation(a),
    scale: a.rAvg > 0 ? t.radarRings : fill(t.radarScale, { max: fmtNum(FIXED_MAX[a.key], lang, a.key === "assists" ? 1 : 0) }),
  }));
  const notes = [last14.length ? "" : t.radarInactive, radarAvg.players ? fill(t.radarCompared, { n: fmtNum(radarAvg.players, lang) }) : ""].filter(Boolean);
  const rounds = s30("rounds");
  const row = (k: string, v: React.ReactNode) => (
    <>
      <td className="stats-key">{k}:</td>
      <td>{v}</td>
    </>
  );
  // The split of the player page: members and average points over the
  // radar in the left half, the totals and ratios beside it.
  const table = (
    <table className="stats summary clan-sum">
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
          <th colSpan={6}>{t.clanSummary}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td className="stats-key pair">{t.members}:</td>
          <td className="pair-value"><b>{fmtNum(all.length, lang)}</b></td>
          <td className="stats-key pair">{t.avgPoints}:</td>
          <td className="pair-value"><b>{fmtNum(Math.round(all.reduce((x, m) => x + Number(m.skill ?? 0), 0) / n), lang)}</b></td>
          {row(t.kills, withAvg(kills))}
        </tr>
        <tr>
          <td colSpan={4} rowSpan={7} className="radar-cell">
            <Radar axes={radar} labels={{ avg: t.radarAll, player: t.radarClan }} notes={notes} />
          </td>
          {row(t.deaths, withAvg(deaths))}
        </tr>
        <tr>{row(t.hs, withAvg(hs))}</tr>
        <tr>{row(t.playTime, perMember(fmtDuration(time), fmtDuration(time / n)))}</tr>
        <tr>{row(t.kpdLong, <Spark values={daily((h) => (h.kills || h.deaths ? h.kills / Math.max(1, h.deaths) : null))} total={kpd(kills, deaths)} current={s14("kills") / Math.max(1, s14("deaths"))} fmt={n2} titles={titles} />)}</tr>
        <tr>{row(t.hpkLong, <Spark values={daily((h) => (h.kills ? h.headshots / h.kills : null))} total={ratio(hs, kills)} current={ratio(s14("headshots"), s14("kills"))} fmt={pc} titles={titles} />)}</tr>
        <tr>{row(t.killsPerMin, n2(time > 0 ? kills / (time / 60) : 0))}</tr>
        <tr>{row(t.winRatio, rounds ? <Bar value={ratio(s30("wins"), rounds)} green label={pc(ratio(s30("wins"), rounds))} /> : "—")}</tr>
        <Row4 k={t.survived} v={rounds ? pc(ratio(s30("survived_count"), rounds)) : "—"} />
        {shots ? (
          <>
            <Row4 k={t.acc} v={<Spark values={daily((h) => (h.shots ? h.hits / h.shots : null))} total={ratio(hits, shotsAll)} current={ratio(s14("hits"), s14("shots"))} fmt={pc} titles={titles} />} />
            <Row4 k={t.shotsPerKill} v={<Spark values={daily((h) => (h.kills && h.shots ? h.shots / h.kills : null))} total={kills && shotsAll ? shotsAll / kills : null} current={s14("kills") ? s14("shots") / s14("kills") : null} fmt={n2} titles={titles} lowerIsBetter />} />
          </>
        ) : null}
      </tbody>
    </table>
  );
  return { table };
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
