import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RankingTable, rankingValues } from "@/components/ranking";
import { Flag, Section, Stats } from "@/components/ui";
import { getClan, getClanFlags, getClanMembers, getInactiveClanMembers } from "@/lib/data";
import { fmtDate, fmtDuration, fmtNum, fmtPct, kpd, ratio } from "@/lib/format";
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
  const order = sortState(await searchParams, rankingValues, "skill");
  const sorted = sortRows(members, rankingValues, order.sort, order.asc);
  // The inactive members follow in the same table, in the same order.
  const goneSorted = sortRows(gone, rankingValues, order.sort, order.asc);
  const base = `/${game}/clans/${c.clanId}`;
  const home = /^https?:\/\//i.test(c.homepage ?? "") ? c.homepage : null;
  return (
    <>
      <Section
        title={
          <>
            <Flag code={flag?.flag} title={flag?.country} />
            {c.tag}
          </>
        }
      >
        <Stats
          title={c.name}
          items={[
            [t.members, fmtNum(stats.members, lang)],
            [t.avgPoints, fmtNum(stats.skill, lang)],
            [t.kills, fmtNum(stats.kills, lang)],
            [t.deaths, fmtNum(stats.deaths, lang)],
            [t.kpd, fmtNum(kpd(stats.kills ?? 0, stats.deaths ?? 0), lang, 2)],
            [t.hpk, fmtPct(ratio(stats.headshots ?? 0, stats.kills ?? 0), lang)],
            [t.playTime, fmtDuration(stats.connection_time)],
            ...(inactive ? ([[t.lastSeen, fmtDate(Math.max(...all.map((m) => Number(m.last_event ?? 0))), lang)]] as [string, string][]) : []),
            ...(home ? ([[t.homepage, <a key="h" href={home} rel="noopener noreferrer nofollow" target="_blank">{home}</a>]] as [string, React.ReactNode][]) : []),
          ]}
        />
      </Section>
      <Section title={t.members}>
        <RankingTable
          game={game}
          rows={sorted}
          firstRank={1}
          inactive={{ title: t.inactiveMembers, rows: goneSorted }}
          sort={{ current: order.sort, asc: order.asc, base, params: order.keep }}
          activityDays={settings.activityDays}
          t={t}
          lang={lang}
        />
      </Section>
    </>
  );
}
