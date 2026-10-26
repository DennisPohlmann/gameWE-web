import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RankingTable, rankingValues } from "@/components/ranking";
import { Flag, Section, Stats } from "@/components/ui";
import { getClan, getClanFlags, getClanMembers } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, kpd, ratio } from "@/lib/format";
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
  const [members, settings, flags] = await Promise.all([getClanMembers(c.clanId), getSettings(), getClanFlags([c.clanId])]);
  const flag = flags.get(c.clanId);
  const order = sortState(await searchParams, rankingValues, "skill");
  const sorted = sortRows(members, rankingValues, order.sort, order.asc);
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
            [t.members, fmtNum(c.members, lang)],
            [t.avgPoints, fmtNum(c.skill, lang)],
            [t.kills, fmtNum(c.kills, lang)],
            [t.deaths, fmtNum(c.deaths, lang)],
            [t.kpd, fmtNum(kpd(c.kills ?? 0, c.deaths ?? 0), lang, 2)],
            [t.hpk, fmtPct(ratio(c.headshots ?? 0, c.kills ?? 0), lang)],
            [t.playTime, fmtDuration(c.connection_time)],
            ...(home ? ([[t.homepage, <a key="h" href={home} rel="noopener noreferrer nofollow" target="_blank">{home}</a>]] as [string, React.ReactNode][]) : []),
          ]}
        />
      </Section>
      <Section title={t.members}>
        <RankingTable game={game} rows={sorted} firstRank={1} sort={{ current: order.sort, asc: order.asc, base: `/${game}/clans/${c.clanId}`, params: order.keep }} activityDays={settings.activityDays} t={t} lang={lang} />
      </Section>
    </>
  );
}
