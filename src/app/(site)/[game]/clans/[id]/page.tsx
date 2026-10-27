import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { MapGate } from "@/components/map-gate";
import { RankingTable, rankingValues } from "@/components/ranking";
import { Flag, Section, Stats } from "@/components/ui";
import { mapGateProps } from "@/lib/consent-server";
import { getClan, getClanFlags, getClanMapPlayers, getClanMembers, getInactiveClanMembers } from "@/lib/data";
import { countryName, fmtDate, fmtDuration, fmtNum, fmtPct, kpd, ratio } from "@/lib/format";
import { mapMarkers } from "@/lib/map-markers";
import { fill, getDict } from "@/lib/i18n";
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
        {gate && markers.length ? (
          <div className="cont-2 clan-top">
            {details}
            <div className="box clan-map">
              <h4 className="map-title">{t.clanMap}</h4>
              <MapGate {...gate} markers={markers} style={settings.mapStyle} />
              <p className="muted">{fill(t.clanMapHint, { n: String(markers.length) })}</p>
            </div>
          </div>
        ) : (
          details
        )}
      </Section>
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
    </>
  );
}
