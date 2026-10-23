import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Flag, Pager, ROW_OPTIONS, Section, TableWrap, pageParam, rowsParam } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { countClans, getClanFlags, getClans } from "@/lib/data";
import { fmtDuration, fmtNum, fmtPct, kpd, localeOf, ratio } from "@/lib/format";
import { getDict } from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getDict()).t.clans };
}

export default async function ClansPage({
  params,
  searchParams,
}: {
  params: Promise<{ game: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { game } = await params;
  const sp = await searchParams;
  const page = pageParam(sp.page);
  const { lang, t } = await getDict();
  const { pageSize } = await getSettings();
  const limit = rowsParam(sp.rows, pageSize);
  const [rows, total] = await Promise.all([getClans(game, limit, (page - 1) * limit), countClans(game)]);
  const flags = await getClanFlags(rows.slice(0, limit).map((c) => c.clanId));
  return (
    <Section title={t.clans}>
      {rows.length ? (
        <>
          <TableWrap>
            <table>
              <thead>
                <tr>
                  <th className="num">#</th>
                  <th>{t.name}</th>
                  <th className="num">{t.members}</th>
                  <th className="num">{t.avgPoints}</th>
                  <th className="num hide-sm">{t.time}</th>
                  <th className="num">{t.kills}</th>
                  <th className="num hide-sm">{t.deaths}</th>
                  <th className="num">{t.kpd}</th>
                  <th className="num">{t.hpk}</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((c, i) => (
                  <tr key={c.clanId}>
                    <td className="rank">{(page - 1) * limit + i + 1}</td>
                    <td>
                      <Flag code={flags.get(c.clanId)?.flag} title={flags.get(c.clanId)?.country} />{" "}
                      <Link className="player" href={`/${game}/clans/${c.clanId}`}>
                        {c.tag}
                      </Link>{" "}
                      <span className="muted">{c.name !== c.tag ? c.name : ""}</span>
                    </td>
                    <td className="num">{fmtNum(c.members, lang)}</td>
                    <td className="num">{fmtNum(c.skill, lang)}</td>
                    <td className="num hide-sm">{fmtDuration(c.connection_time)}</td>
                    <td className="num">{fmtNum(c.kills, lang)}</td>
                    <td className="num hide-sm">{fmtNum(c.deaths, lang)}</td>
                    <td className="num">{fmtNum(kpd(c.kills, c.deaths), lang, 2)}</td>
                    <td className="num">{fmtPct(ratio(c.headshots, c.kills), lang)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager base={`/${game}/clans`} params={{ rows: limit !== pageSize ? limit : undefined }} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </Section>
  );
}
