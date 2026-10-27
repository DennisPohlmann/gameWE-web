import type { Metadata } from "next";
import Link from "next/link";
import { Empty, Flag, Pager, PctBar, ROW_OPTIONS, Section, SortTh, TableWrap, pageParam, rowsParam, strParam } from "@/components/ui";
import { getSettings } from "@/lib/settings";
import { clanSorts, countClans, countInactiveClans, getClanFlags, getClans, getInactiveClans } from "@/lib/data";
import { sortState } from "@/lib/table-sort";
import { fmtDate, fmtDuration, fmtNum, kpd, localeOf, ratio } from "@/lib/format";
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
  // ?view=inactive: the clans whose members (all but at most one) the
  // collector moved to the inactive players, last seen first.
  const inactive = strParam(sp.view) === "inactive";
  const { sort, asc, keep } = sortState(sp, clanSorts, inactive ? "activity" : "skill");
  const [rows, total] = await Promise.all(
    inactive
      ? [getInactiveClans(game, limit, (page - 1) * limit, sort, asc), countInactiveClans(game)]
      : [getClans(game, limit, (page - 1) * limit, sort, asc), countClans(game)],
  );
  const base = `/${game}/clans`;
  const keepParams = { view: inactive ? "inactive" : undefined, ...keep, rows: limit !== pageSize ? limit : undefined };
  const th = (label: string, key: keyof typeof clanSorts, cls = "num") => <SortTh label={label} sortKey={key} className={cls} current={sort} asc={asc} base={base} params={keepParams} />;
  // On phones the inactive clans show only name, members and last seen.
  const narrow = inactive ? "num hide-sm" : "num";
  const flags = await getClanFlags(rows.slice(0, limit).map((c) => c.clanId), inactive);
  return (
    <Section
      title={
        <span className="subtabs">
          <Link href={base} className={inactive ? undefined : "active"}>
            {t.ranking}
          </Link>
          <Link href={`${base}?view=inactive`} className={inactive ? "active" : undefined}>
            {t.inactiveClans}
          </Link>
        </span>
      }
    >
      {rows.length ? (
        <>
          {inactive ? <p className="lead">{t.inactiveClansHint}</p> : null}
          <TableWrap>
            <table>
              <thead>
                <tr>
                  {inactive ? null : <th className="num">#</th>}
                  {th(t.name, "tag", "")}
                  {th(t.members, "members")}
                  {th(t.avgPoints, "skill", narrow)}
                  {inactive ? th(t.lastSeen, "activity") : null}
                  {th(t.time, "time", "num hide-sm")}
                  {th(t.kills, "kills", narrow)}
                  {th(t.deaths, "deaths", "num hide-sm")}
                  {th(t.kpd, "kpd", narrow)}
                  {th(t.hpk, "hpk", inactive ? "barcell hide-sm" : "barcell")}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, limit).map((c, i) => (
                  <tr key={c.clanId}>
                    {inactive ? null : <td className="rank">{(page - 1) * limit + i + 1}</td>}
                    <td>
                      <Flag code={flags.get(c.clanId)?.flag} title={flags.get(c.clanId)?.country} />{" "}
                      <Link className="player" href={`/${game}/clans/${c.clanId}`}>
                        {c.tag}
                      </Link>{" "}
                      <span className="muted">{c.name !== c.tag ? c.name : ""}</span>
                    </td>
                    <td className="num">{fmtNum(c.members, lang)}</td>
                    <td className={narrow}>{fmtNum(c.skill, lang)}</td>
                    {inactive ? <td className="num">{fmtDate(c.last_event, lang)}</td> : null}
                    <td className="num hide-sm">{fmtDuration(c.connection_time)}</td>
                    <td className={narrow}>{fmtNum(c.kills, lang)}</td>
                    <td className="num hide-sm">{fmtNum(c.deaths, lang)}</td>
                    <td className={narrow}>{fmtNum(kpd(c.kills, c.deaths), lang, 2)}</td>
                    <td className={inactive ? "barcell hide-sm" : "barcell"}>
                      <PctBar value={ratio(c.headshots, c.kills)} lang={lang} />
                    </td>
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
