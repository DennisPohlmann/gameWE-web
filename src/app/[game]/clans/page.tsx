import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Flag, Pager, ROW_OPTIONS, Section, SortTh, TableWrap, pageParam, rowsParam } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { clanSorts, countClans, getClanFlags, getClans } from "@/lib/data";
import { sortState } from "@/lib/table-sort";
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
  const { sort, asc, keep } = sortState(sp, clanSorts, "skill");
  const [rows, total] = await Promise.all([getClans(game, limit, (page - 1) * limit, sort, asc), countClans(game)]);
  const base = `/${game}/clans`;
  const keepParams = { ...keep, rows: limit !== pageSize ? limit : undefined };
  const th = (label: string, key: keyof typeof clanSorts, cls = "num") => <SortTh label={label} sortKey={key} className={cls} current={sort} asc={asc} base={base} params={keepParams} />;
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
                  {th(t.name, "tag", "")}
                  {th(t.members, "members")}
                  {th(t.avgPoints, "skill")}
                  {th(t.time, "time", "num hide-sm")}
                  {th(t.kills, "kills")}
                  {th(t.deaths, "deaths", "num hide-sm")}
                  {th(t.kpd, "kpd")}
                  {th(t.hpk, "hpk")}
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
          <Pager base={base} params={keepParams} page={page} pages={Math.max(1, Math.ceil(total / limit))} total={total} rows={{ value: limit, options: ROW_OPTIONS }} locale={localeOf(lang)} labels={t} />
        </>
      ) : (
        <Empty>{t.noData}</Empty>
      )}
    </Section>
  );
}
